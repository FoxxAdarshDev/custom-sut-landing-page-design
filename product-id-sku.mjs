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

// Function to read data from Google Sheets
async function readGoogleSheet(range) {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range,
        });
        return response.data.values || [];
    } catch (error) {
        console.error('Error reading Google Sheet:', error);
        throw error;
    }
}

// Function to clean price
function cleanPrice(price) {
    let cleanedPrice = price.replace(/[^0-9.]/g, ''); // Remove invalid characters
    cleanedPrice = parseFloat(cleanedPrice).toFixed(2); // Ensure two decimal places
    console.log(`Cleaned price: ${cleanedPrice}`);
    return cleanedPrice;
}

// Function to fetch Shopify variant by SKU
async function fetchVariantBySKU(sku) {
    const query = `
        query {
            productVariants(first: 1, query: "sku:${sku}") {
                edges {
                    node {
                        id
                        sku
                        price
                        compareAtPrice
                    }
                }
            }
        }
    `;

    try {
        console.log(`Fetching variant for SKU: ${sku}`);
        const response = await fetch(`https://${shopName}.myshopify.com/admin/api/2024-01/graphql.json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': shopifyAccessToken,
            },
            body: JSON.stringify({ query }),
        });

        const { data } = await response.json();
        const edges = data.productVariants.edges;
        if (edges.length > 0) {
            return edges[0].node;
        }
    } catch (error) {
        console.error('Error fetching variant by SKU:', error);
        return null;
    }
}

// Function to fetch product ID by variant SKU
async function fetchProductIdBySKU(sku) {
    const query = `
        query {
            productVariants(first: 5, query: "sku:${sku}") {
                edges {
                    node {
                        id
                        sku
                        product {
                            id
                            handle
                            title
                        }
                    }
                }
            }
        }
    `;

    try {
        console.log(`Fetching product ID for SKU: ${sku}`);
        const response = await fetch(`https://${shopName}.myshopify.com/admin/api/2024-01/graphql.json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': shopifyAccessToken,
            },
            body: JSON.stringify({ query }),
        });

        const { data, errors } = await response.json();
        
        if (errors) {
            console.error('GraphQL errors:', errors);
            return null;
        }

        const edges = data.productVariants.edges;
        if (edges.length > 0) {
            // Find the exact SKU match (in case of partial matches)
            const exactMatch = edges.find(edge => edge.node.sku === sku);
            const targetNode = exactMatch ? exactMatch.node : edges[0].node;
            
            const productId = targetNode.product.id;
            // Extract numeric ID from GraphQL ID (e.g., "gid://shopify/Product/123456" -> "123456")
            const numericProductId = productId.replace('gid://shopify/Product/', '');
            
            console.log(`Raw GraphQL Product ID: ${productId}`);
            console.log(`Extracted numeric Product ID: ${numericProductId}`);
            console.log(`Found product ID ${numericProductId} for SKU: ${sku}`);
            console.log(`Product title: ${targetNode.product.title}`);
            console.log(`Product handle: ${targetNode.product.handle}`);
            console.log(`Variant SKU confirmed: ${targetNode.sku}`);
            
            return numericProductId;
        } else {
            console.log(`No product found for SKU: ${sku}`);
            return null;
        }
    } catch (error) {
        console.error('Error fetching product ID by SKU:', error);
        return null;
    }
}

// Function to update a product variant in Shopify
async function updateShopifyVariant(variantId, variantPrice, compareAtVariantPrice, retries = 3) {
    const mutation = `
        mutation productVariantUpdate($input: ProductVariantInput!) {
            productVariantUpdate(input: $input) {
                productVariant {
                    id
                    price
                    compareAtPrice
                }
                userErrors {
                    field
                    message
                }
            }
        }
    `;

    const variables = {
        input: {
            id: variantId,
            price: variantPrice.toString(),
            compareAtPrice: compareAtVariantPrice ? compareAtVariantPrice.toString() : null
        }
    };

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`Attempt ${attempt} - Updating variant with ID: ${variantId}`);
            console.log(`Payload: ${JSON.stringify(variables)}`);

            const response = await fetch(`https://${shopName}.myshopify.com/admin/api/2024-01/graphql.json`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': shopifyAccessToken,
                },
                body: JSON.stringify({ query: mutation, variables }),
            });

            const { data, errors } = await response.json();

            if (errors) {
                console.error('GraphQL errors:', errors);
                if (attempt < retries) {
                    console.log('Retrying...');
                    await new Promise((resolve) => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
                }
                continue;
            }

            const productVariant = data.productVariantUpdate.productVariant;
            console.log(`Successfully updated variant ${variantId}. New Price: ${productVariant.price}, Compare At Price: ${productVariant.compareAtPrice}`);

            return;
        } catch (error) {
            console.error(`Error during attempt ${attempt} updating variant ${variantId}:`, error);
        }
    }
}

// Function to append missing SKUs to the Google Sheet
async function appendToMissingSKU(sku) {
    const range = 'Missing SKU on Website!A:A'; // Adjust the range where you want to add missing SKUs
    const values = [[sku]]; // Wrap SKU in an array

    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId,
            range: range,
            valueInputOption: 'RAW',
            requestBody: {
                values: values,
            },
        });
        console.log(`Missing SKU added: ${sku}`);
    } catch (error) {
        console.error('Error appending missing SKU:', error);
    }
}

// Function to update product ID in Google Sheet
async function updateProductIdInSheet(rowIndex, productId) {
    const range = `Sheet1!B${rowIndex + 1}`; // Column B, adjust row index (+1 because sheets are 1-indexed)
    
    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: range,
            valueInputOption: 'RAW',
            requestBody: {
                values: [[productId]],
            },
        });
        console.log(`Updated row ${rowIndex + 1} with product ID: ${productId}`);
    } catch (error) {
        console.error(`Error updating product ID in row ${rowIndex + 1}:`, error);
    }
}

// Main function to update Shopify prices from Google Sheet
async function updatePricesFromSheet(range) {
    const rows = await readGoogleSheet(range);
    const [headers, ...data] = rows;
    const skuIndex = headers.indexOf('skus');
    const variantPriceIndex = headers.indexOf('Variant Price');
    const compareAtVariantPriceIndex = headers.indexOf('Variant Compare At Price');

    if (skuIndex === -1 || variantPriceIndex === -1 || compareAtVariantPriceIndex === -1) {
        console.error('Required columns not found in Google Sheet');
        return;
    }

    for (const row of data) {
        const [
            sku,
            variantPrice = '0',
            compareAtVariantPrice = '0'
        ] = [
            row[skuIndex],
            cleanPrice(row[variantPriceIndex]),
            cleanPrice(row[compareAtVariantPriceIndex]),
        ];

        if (!sku || !variantPrice || !compareAtVariantPrice) {
            console.warn(`Skipping row: Missing SKU or price fields`);
            continue;
        }

        console.log(`Processing SKU: ${sku}, Variant Price: ${variantPrice}, Compare At Variant Price: ${compareAtVariantPrice}`);

        const variant = await fetchVariantBySKU(sku);
        if (!variant) {
            console.warn(`SKU ${sku} not found in Shopify`);
            // Log missing SKU in the sheet and console
            await appendToMissingSKU(sku);
            continue;
        }

        console.log(`SKU found on store: ${sku}`);
        console.log(`Current Store Prices -> Price: ${variant.price}, Compare At Price: ${variant.compareAtPrice}`);

        await updateShopifyVariant(variant.id, variantPrice, compareAtVariantPrice);

        await new Promise((resolve) => setTimeout(resolve, 1000)); // Avoid hitting rate limits
    }
}

// Main function to populate product IDs from SKUs in Google Sheet
async function populateProductIdsFromSheet(range) {
    const rows = await readGoogleSheet(range);
    const [headers, ...data] = rows;
    const skuIndex = headers.indexOf('skus') !== -1 ? headers.indexOf('skus') : 0; // Default to first column if 'skus' not found

    console.log(`Found ${data.length} rows to process`);
    console.log(`SKU column index: ${skuIndex}`);

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const sku = row[skuIndex];

        if (!sku) {
            console.warn(`Skipping row ${i + 2}: No SKU found`);
            continue;
        }

        console.log(`Processing row ${i + 2}, SKU: ${sku}`);

        // Check if product ID already exists in column B
        const existingProductId = row[1]; // Column B (index 1)
        if (existingProductId && existingProductId.trim() !== '') {
            console.log(`Row ${i + 2} already has product ID: ${existingProductId}`);
            continue;
        }

        const productId = await fetchProductIdBySKU(sku);
        if (productId) {
            await updateProductIdInSheet(i + 1, productId); // +1 because headers are at index 0
            console.log(`Successfully updated row ${i + 2} with product ID: ${productId}`);
        } else {
            console.warn(`Could not find product ID for SKU: ${sku}`);
            // Log missing SKU
            await appendToMissingSKU(sku);
        }

        // Add delay to avoid hitting rate limits
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
}

// Endpoint to trigger the price update process
app.get('/update-prices', async (req, res) => {
    const range = 'Sheet1!A:C'; // Adjust the range as per your sheet
    try {
        await updatePricesFromSheet(range);
        res.send('Prices updated successfully');
    } catch (error) {
        console.error('Error while updating prices:', error);
        res.status(500).send('Error updating prices');
    }
});

// Endpoint to populate product IDs from SKUs
app.get('/populate-product-ids', async (req, res) => {
    const range = 'Sheet1!A:B'; // Column A for SKUs, Column B for Product IDs
    try {
        await populateProductIdsFromSheet(range);
        res.send('Product IDs populated successfully');
    } catch (error) {
        console.error('Error while populating product IDs:', error);
        res.status(500).send('Error populating product IDs');
    }
});

// Start the server
const PORT = process.env.PORT || 8700;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Available endpoints:`);
    console.log(`- GET /update-prices - Update Shopify prices from Google Sheet`);
    console.log(`- GET /populate-product-ids - Populate product IDs from SKUs in Google Sheet`);
});
