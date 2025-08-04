
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import fs from 'fs';

const app = express();
dotenv.config();
app.use(cors());

// Shopify and Google Sheets Setup
const shopName = process.env.SHOPNAME || 'shopfls';
const shopifyAccessToken = process.env.SHOPIFYACCESSTOKEN || 'shpat_bf9cb1172aa91dc7';
const spreadsheetId = process.env.SPREADSHEETID || '1Swv1sNAmDl0SgEJ7MyX_ha0Is2q0eVmBvUnOybwmBEc';

const credentials = JSON.parse(fs.readFileSync('credentials.json'));
const auth = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
);
const sheets = google.sheets({ version: 'v4', auth });

// Function to fetch all product variants from Shopify using GraphQL with improved batching
async function fetchAllVariants() {
    let allVariants = [];
    let hasNextPage = true;
    let cursor = null;
    let totalFetched = 0;
    let batchNumber = 0;
    const batchSize = 200; // Reduced batch size for more reliable fetching
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 5;

    console.log('\n=== STARTING VARIANT FETCH PROCESS ===');
    console.log(`Target: 12,000+ variants | Batch size: ${batchSize} | Status filter: ACTIVE only`);
    console.log('==========================================\n');

    while (hasNextPage && consecutiveFailures < maxConsecutiveFailures) {
        batchNumber++;
        const query = `
            query getVariants($first: Int!, $after: String) {
                productVariants(first: $first, after: $after) {
                    edges {
                        node {
                            id
                            sku
                            price
                            compareAtPrice
                            inventoryQuantity
                            product {
                                title
                                id
                                handle
                                status
                            }
                        }
                        cursor
                    }
                    pageInfo {
                        hasNextPage
                        endCursor
                    }
                }
            }
        `;

        const variables = {
            first: batchSize,
            after: cursor
        };

        let retryCount = 0;
        const maxRetries = 5; // Increased retries
        let batchSuccess = false;
        let batchData = null;

        // Batch processing with retry logic
        while (!batchSuccess && retryCount <= maxRetries) {
            try {
                const progressPercent = totalFetched > 0 ? Math.min(100, (totalFetched / 12000) * 100).toFixed(1) : '0.0';

                console.log(`🔄 Processing batch ${batchNumber} | Progress: ${progressPercent}% | Fetched: ${totalFetched}`);
                console.log(`   ${cursor ? `Cursor: ...${cursor.slice(-15)}` : 'Starting from beginning'}`);

                const response = await fetch(`https://${shopName}.myshopify.com/admin/api/2024-01/graphql.json`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Shopify-Access-Token': shopifyAccessToken,
                    },
                    body: JSON.stringify({ query, variables }),
                });

                // Handle rate limiting more aggressively
                if (response.status === 429) {
                    const retryAfter = response.headers.get('retry-after') || '5';
                    const waitTime = Math.max(parseInt(retryAfter) * 1000, 5000 * (retryCount + 1));
                    console.log(`   🚦 Rate limited. Waiting ${waitTime/1000}s before retry ${retryCount + 1}/${maxRetries}...`);
                    await new Promise((resolve) => setTimeout(resolve, waitTime));
                    retryCount++;
                    continue;
                }

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const { data, errors } = await response.json();

                if (errors) {
                    console.error(`   ❌ GraphQL errors in batch ${batchNumber}:`, errors);
                    if (retryCount < maxRetries) {
                        console.log(`   🔄 Retrying due to GraphQL errors (${retryCount + 1}/${maxRetries})...`);
                        retryCount++;
                        await new Promise((resolve) => setTimeout(resolve, 3000 * (retryCount + 1)));
                        continue;
                    }
                    throw new Error(`GraphQL errors: ${JSON.stringify(errors)}`);
                }

                if (!data || !data.productVariants || !Array.isArray(data.productVariants.edges)) {
                    console.error(`   ❌ Invalid response structure in batch ${batchNumber}:`, data);
                    if (retryCount < maxRetries) {
                        console.log(`   🔄 Retrying due to invalid data (${retryCount + 1}/${maxRetries})...`);
                        retryCount++;
                        await new Promise((resolve) => setTimeout(resolve, 2000));
                        continue;
                    }
                    throw new Error('Invalid response structure');
                }

                batchData = data;
                batchSuccess = true;
                consecutiveFailures = 0; // Reset failure counter on success

            } catch (error) {
                retryCount++;
                console.error(`   ❌ Batch ${batchNumber} error (attempt ${retryCount}/${maxRetries + 1}): ${error.message}`);

                if (retryCount <= maxRetries) {
                    const waitTime = Math.min(10000, 2000 * Math.pow(2, retryCount - 1)); // Exponential backoff with cap
                    console.log(`   ⏳ Waiting ${waitTime/1000}s before retry...`);
                    await new Promise((resolve) => setTimeout(resolve, waitTime));
                } else {
                    console.error(`   💥 Batch ${batchNumber} failed after ${maxRetries + 1} attempts`);
                    consecutiveFailures++;

                    if (consecutiveFailures >= maxConsecutiveFailures) {
                        console.error(`\n💥 STOPPING: ${maxConsecutiveFailures} consecutive batch failures`);
                        break;
                    }

                    // Try to skip this batch and continue if we have a cursor
                    if (cursor) {
                        console.log(`   ⏭️  Skipping failed batch and attempting to continue...`);
                        batchSuccess = true; // Mark as "success" to continue the loop
                        batchData = { productVariants: { edges: [], pageInfo: { hasNextPage: true, endCursor: cursor } } };
                    } else {
                        break;
                    }
                }
            }
        }

        // Process successful batch data
        if (batchSuccess && batchData) {
            const rawVariants = batchData.productVariants.edges || [];

            // Filter for active products only
            const activeVariants = rawVariants
                .filter(edge => edge.node.product.status === 'ACTIVE')
                .map(edge => {
                    const variant = edge.node;
                    return {
                        ...variant,
                        price: variant.price || '0.00',
                        compareAtPrice: variant.compareAtPrice || '0.00'
                    };
                });

            const draftFiltered = rawVariants.length - activeVariants.length;

            // Add to main collection
            allVariants = allVariants.concat(activeVariants);
            totalFetched += activeVariants.length;

            // Update pagination info
            hasNextPage = batchData.productVariants.pageInfo.hasNextPage;
            cursor = batchData.productVariants.pageInfo.endCursor;

            console.log(`   ✅ Batch ${batchNumber}: ${activeVariants.length} active variants | ${draftFiltered} draft filtered`);
            console.log(`   📊 Running total: ${totalFetched} variants`);

            if (!hasNextPage) {
                console.log(`   🏁 Pagination complete - no more batches available`);
                break;
            }

            // Smart rate limiting - adjust based on success/failure
            const rateLimitDelay = consecutiveFailures > 0 ? 1000 : 500;
            await new Promise((resolve) => setTimeout(resolve, rateLimitDelay));
        }
    }

    console.log('\n=== FETCH PROCESS COMPLETED ===');
    console.log(`🎯 Total variants fetched: ${allVariants.length}`);
    console.log(`📦 Total batches processed: ${batchNumber}`);
    console.log(`🔄 Consecutive failures: ${consecutiveFailures}`);

    if (allVariants.length < 10000) {
        console.log(`⚠️  WARNING: Only ${allVariants.length} variants fetched (expected 12,000+)`);
        console.log(`   Possible causes: API limits, network issues, many draft products, or store has fewer variants`);
    } else {
        console.log(`✅ Comprehensive fetch completed: ${allVariants.length} variants`);
    }

    // Data quality analysis
    const qualityAnalysis = analyzeDataQuality(allVariants);
    console.log('\n📈 DATA QUALITY ANALYSIS:');
    console.log(`   Variants with pricing: ${qualityAnalysis.withPrice} (${qualityAnalysis.pricePercent}%)`);
    console.log(`   Variants with compare pricing: ${qualityAnalysis.withComparePrice} (${qualityAnalysis.comparePricePercent}%)`);
    console.log(`   Variants without SKU: ${qualityAnalysis.withoutSku} (${qualityAnalysis.noSkuPercent}%)`);
    console.log(`   Unique products represented: ${qualityAnalysis.uniqueProducts}`);
    console.log('===============================\n');

    return allVariants;
}

// Helper function to analyze data quality
function analyzeDataQuality(variants) {
    const withPrice = variants.filter(v => v.price && v.price !== '0.00').length;
    const withComparePrice = variants.filter(v => v.compareAtPrice && v.compareAtPrice !== '0.00').length;
    const withoutSku = variants.filter(v => !v.sku || v.sku.trim() === '').length;
    const uniqueProducts = new Set(variants.map(v => v.product.id)).size;

    const total = variants.length;

    return {
        withPrice,
        withComparePrice,
        withoutSku,
        uniqueProducts,
        pricePercent: total > 0 ? ((withPrice / total) * 100).toFixed(1) : '0.0',
        comparePricePercent: total > 0 ? ((withComparePrice / total) * 100).toFixed(1) : '0.0',
        noSkuPercent: total > 0 ? ((withoutSku / total) * 100).toFixed(1) : '0.0'
    };
}

// Function to find duplicate SKUs
function findDuplicateSKUs(variants) {
    const skuMap = new Map();
    const duplicates = [];
    let skippedVariants = 0;
    let totalVariantsProcessed = 0;

    console.log(`Starting duplicate SKU analysis on ${variants.length} variants...`);

    // Group variants by SKU
    variants.forEach(variant => {
        totalVariantsProcessed++;

        if (!variant.sku || variant.sku.trim() === '') {
            skippedVariants++;
            return; // Skip variants without SKU
        }

        const sku = variant.sku.trim();
        if (!skuMap.has(sku)) {
            skuMap.set(sku, []);
        }
        skuMap.get(sku).push(variant);
    });

    console.log(`Processed ${totalVariantsProcessed} variants`);
    console.log(`Skipped ${skippedVariants} variants without SKU`);
    console.log(`Found ${skuMap.size} unique SKUs`);

    // Find SKUs that appear more than once
    skuMap.forEach((variantList, sku) => {
        if (variantList.length > 1) {
            console.log(`Found duplicate SKU: ${sku} (${variantList.length} occurrences)`);
            duplicates.push({
                sku: sku,
                variants: variantList,
                count: variantList.length
            });
        }
    });

    console.log(`Found ${duplicates.length} duplicate SKUs out of ${skuMap.size} total SKUs`);
    return duplicates;
}

// Function to clear existing data in the sheet
async function clearSheet(range) {
    try {
        await sheets.spreadsheets.values.clear({
            spreadsheetId: spreadsheetId,
            range: range,
        });
        console.log(`Cleared data in range: ${range}`);
    } catch (error) {
        console.error('Error clearing sheet:', error);
    }
}

// Function to generate product handle from title (for URL creation)
function generateHandleFromTitle(title) {
    if (!title) return 'unknown-product';

    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

// Function to create a new sheet if it doesn't exist
async function createSheetIfNotExists(sheetName) {
    try {
        // Get spreadsheet metadata to check existing sheets
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: spreadsheetId,
        });

        const existingSheet = spreadsheet.data.sheets.find(sheet => 
            sheet.properties.title === sheetName
        );

        if (!existingSheet) {
            console.log(`Creating new sheet: ${sheetName}`);
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: spreadsheetId,
                requestBody: {
                    requests: [{
                        addSheet: {
                            properties: {
                                title: sheetName
                            }
                        }
                    }]
                }
            });
            console.log(`Successfully created sheet: ${sheetName}`);
        } else {
            console.log(`Sheet already exists: ${sheetName}`);
        }
    } catch (error) {
        console.error(`Error creating sheet ${sheetName}:`, error);
        throw error;
    }
}

// Function to save duplicate SKUs to Google Sheet
async function saveDuplicatesToSheet(duplicates) {
    const sheetName = 'Duplicate_SKUs';
    const sheetRange = `${sheetName}!A:H`; // Extended to column H for Live URL

    try {
        // Create sheet if it doesn't exist
        await createSheetIfNotExists(sheetName);

        // Clear existing data first
        await clearSheet(sheetRange);

        // Prepare headers
        const headers = [
            'SKU',
            'Product Title',
            'Product ID',
            'Variant ID',
            'Variant Price',
            'Compare At Price',
            'Duplicate Count',
            'Live URL'
        ];

        // Prepare data rows
        const rows = [headers];

        duplicates.forEach(duplicate => {
            duplicate.variants.forEach(variant => {
                // Ensure proper data formatting
                const variantPrice = variant.price ? parseFloat(variant.price).toFixed(2) : '0.00';
                const comparePrice = variant.compareAtPrice ? parseFloat(variant.compareAtPrice).toFixed(2) : '0.00';

                // Generate live URL for the product/variant
                const productHandle = variant.product.handle || generateHandleFromTitle(variant.product.title);
                const baseUrl = 'https://www.foxxlifesciences.com';
                let liveUrl = `${baseUrl}/products/${productHandle}`;

                // If variant has specific ID and it's not the default variant, add variant parameter
                if (variant.id && variant.id !== variant.product.id) {
                    const numericVariantId = variant.id.replace('gid://shopify/ProductVariant/', '');
                    liveUrl += `?variant=${numericVariantId}`;
                }

                rows.push([
                    duplicate.sku || '',
                    variant.product.title || '',
                    variant.product.id || '',
                    variant.id || '',
                    variantPrice,
                    comparePrice,
                    duplicate.count || 0,
                    liveUrl
                ]);
            });
        });

        console.log(`Prepared ${rows.length - 1} data rows for saving to sheet`);

        const response = await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: sheetRange,
            valueInputOption: 'RAW',
            requestBody: {
                values: rows,
            },
        });

        console.log(`Successfully saved ${rows.length - 1} duplicate variant records to sheet`);
        console.log(`Updated range: ${response.data.updatedRange}`);
        return response.data;
    } catch (error) {
        console.error('Error saving to sheet:', error);
        throw error;
    }
}

// Function to create summary of duplicates
async function saveDuplicateSummaryToSheet(duplicates) {
    const sheetName = 'Duplicate_Summary';
    const summaryRange = `${sheetName}!A:D`; // Extended to column D for Sample URL

    try {
        // Create sheet if it doesn't exist
        await createSheetIfNotExists(sheetName);

        // Clear existing data first
        await clearSheet(summaryRange);

        // Prepare headers
        const headers = [
            'SKU',
            'Duplicate Count',
            'Product Titles',
            'Sample Live URL'
        ];

        // Prepare summary data
        const rows = [headers];

        duplicates.forEach(duplicate => {
            const productTitles = [...new Set(duplicate.variants.map(v => v.product.title))].join(', ');

            // Get first variant for sample URL
            const firstVariant = duplicate.variants[0];
            const productHandle = firstVariant.product.handle || generateHandleFromTitle(firstVariant.product.title);
            const baseUrl = 'https://www.foxxlifesciences.com';
            let sampleUrl = `${baseUrl}/products/${productHandle}`;

            // Add variant parameter if available
            if (firstVariant.id && firstVariant.id !== firstVariant.product.id) {
                const numericVariantId = firstVariant.id.replace('gid://shopify/ProductVariant/', '');
                sampleUrl += `?variant=${numericVariantId}`;
            }

            rows.push([
                duplicate.sku,
                duplicate.count,
                productTitles,
                sampleUrl
            ]);
        });

        const response = await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: summaryRange,
            valueInputOption: 'RAW',
            requestBody: {
                values: rows,
            },
        });

        console.log(`Successfully saved ${rows.length - 1} duplicate SKU summaries to sheet`);
        console.log(`Updated range: ${response.data.updatedRange}`);
        return response.data;
    } catch (error) {
        console.error('Error saving summary to sheet:', error);
        throw error;
    }
}

// Main function to find and save duplicate SKUs
async function findAndSaveDuplicateSKUs() {
    try {
        console.log('Starting duplicate SKU detection...');

        // Fetch all variants from Shopify
        const allVariants = await fetchAllVariants();

        if (allVariants.length === 0) {
            console.log('No variants found in the store');
            return;
        }

        // Find duplicate SKUs
        const duplicates = findDuplicateSKUs(allVariants);

        if (duplicates.length === 0) {
            console.log('No duplicate SKUs found in the store');
            return;
        }

        console.log(`Found ${duplicates.length} duplicate SKUs`);

        // Save detailed duplicates to sheet
        await saveDuplicatesToSheet(duplicates);

        // Save summary to sheet
        await saveDuplicateSummaryToSheet(duplicates);

        console.log('\n=== DUPLICATE SKU DETECTION SUMMARY ===');
        console.log(`✅ Total variants checked: ${allVariants.length}`);
        console.log(`🔍 Duplicate SKUs found: ${duplicates.length}`);
        console.log(`📊 Total duplicate variants: ${duplicates.reduce((sum, dup) => sum + dup.count, 0)}`);
        console.log('=========================================');
        console.log('\nDuplicate SKU detection completed successfully!');

        return {
            totalVariants: allVariants.length,
            duplicateSkus: duplicates.length,
            totalDuplicateVariants: duplicates.reduce((sum, dup) => sum + dup.count, 0)
        };

    } catch (error) {
        console.error('Error in duplicate SKU detection:', error);
        throw error;
    }
}

// Endpoint to trigger the duplicate SKU detection process
app.get('/find-duplicate-skus', async (req, res) => {
    try {
        const result = await findAndSaveDuplicateSKUs();
        res.json({
            success: true,
            message: 'Duplicate SKUs found and saved successfully',
            data: result
        });
    } catch (error) {
        console.error('Error while finding duplicate SKUs:', error);
        res.status(500).json({
            success: false,
            message: 'Error finding duplicate SKUs',
            error: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        shopName: shopName,
        spreadsheetId: spreadsheetId
    });
});

// Start the server
const PORT = process.env.PORT || 8700;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Shop: ${shopName}`);
    console.log(`Spreadsheet ID: ${spreadsheetId}`);
    console.log('\nEndpoints:');
    console.log(`- GET /find-duplicate-skus - Find and save duplicate SKUs`);
    console.log(`- GET /health - Health check`);
});
