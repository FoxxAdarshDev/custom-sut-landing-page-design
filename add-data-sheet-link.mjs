
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
const shopName = 'shopfls';
const shopifyAccessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const spreadsheetId = '15JzL4vPq-QrxyE6FBOl8XqBSVFau16Q_VJKqU4M9XDw'; // Replace with your spreadsheet ID

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

// Function to fetch Shopify variant by SKU
async function fetchVariantBySKU(sku) {
    const query = `
        query {
            productVariants(first: 1, query: "sku:${sku}") {
                edges {
                    node {
                        id
                        sku
                        product {
                            id
                            descriptionHtml
                       }
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

// Function to update videos tab in product description
async function updateVideosTab(productId, currentDescriptionHtml, iframeHtml, sku) {
    // Check if the videos tab exists
    if (!currentDescriptionHtml.includes('id="videos"')) {
        console.log(`Product ${sku} does not have a videos tab - skipping`);
        return;
    }

    // Extract the videos tab content
    const videosTabRegex = /<div[^>]*id="videos"[^>]*>(.*?)<\/div>/s;
    const videosTabMatch = currentDescriptionHtml.match(videosTabRegex);
    
    if (!videosTabMatch) {
        console.log(`Could not find videos tab content for SKU: ${sku}`);
        return;
    }

    const videosTabContent = videosTabMatch[1];
    
    // Check if iframe already exists in the videos tab to prevent duplicates
    const existingIframeRegex = /<iframe[^>]*>/i;
    if (existingIframeRegex.test(videosTabContent)) {
        console.log(`SKU ${sku} already has an iframe in videos tab - removing existing iframe first`);
        
        // Remove all existing iframes from the videos tab content
        const contentWithoutIframes = videosTabContent.replace(/<iframe[^>]*>.*?<\/iframe>/gis, '');
        
        // Remove the "To be loaded" paragraph
        const updatedContent = contentWithoutIframes.replace(/<p>To be loaded<\/p>\s*/i, '');
        
        // Add the new iframe and remaining content
        const finalContent = iframeHtml + '\n' + updatedContent;
        
        // Replace the entire videos tab in the description
        const newDescriptionHtml = currentDescriptionHtml.replace(videosTabRegex, `<div class="tab-content" id="videos">${finalContent}</div>`);
        
        console.log(`Replaced existing iframe for SKU: ${sku}`);
        
        // Update the current description for further processing
        currentDescriptionHtml = newDescriptionHtml;
    } else {
        // Remove the "To be loaded" paragraph
        const updatedContent = videosTabContent.replace(/<p>To be loaded<\/p>\s*/i, '');
        
        // Use the provided iframe HTML directly and add the remaining content
        const finalContent = iframeHtml + '\n' + updatedContent;
        
        // Replace the entire videos tab in the description
        const newDescriptionHtml = currentDescriptionHtml.replace(videosTabRegex, `<div class="tab-content" id="videos">${finalContent}</div>`);

        // Check if the content was actually changed
        if (currentDescriptionHtml === newDescriptionHtml) {
            console.log(`No changes needed for SKU: ${sku} - videos tab already up to date`);
            return;
        }
        
        // Update the current description for further processing
        currentDescriptionHtml = newDescriptionHtml;
    }

    const mutation = `
        mutation productUpdate($input: ProductInput!) {
            productUpdate(input: $input) {
                product {
                    id
                    descriptionHtml
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
            id: productId,
            descriptionHtml: currentDescriptionHtml,
        }
    };

    try {
        console.log(`Updating videos tab for SKU: ${sku}`);
        console.log(`Adding iframe HTML: ${iframeHtml.substring(0, 100)}...`);

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
            return;
        }

        console.log(`Successfully updated videos tab for SKU: ${sku}`);
    } catch (error) {
        console.error('Error updating product description:', error);
    }
}

// Main function to update videos tabs from Google Sheet
async function updateVideosFromSheet(range) {
    const rows = await readGoogleSheet(range);

    if (!rows.length) {
        console.error('No data found in Google Sheet');
        throw new Error('No data found in Google Sheet');
    }

    const [headers, ...data] = rows;

    if (!headers || !Array.isArray(headers)) {
        console.error('Invalid headers in Google Sheet');
        throw new Error('Invalid headers in Google Sheet');
    }

    const skuIndex = headers.indexOf('SKU');
    const iframeHtmlIndex = headers.indexOf('Iframe Link');

    if (skuIndex === -1 || iframeHtmlIndex === -1) {
        console.error('Required columns (SKU, Iframe Link) not found in Google Sheet');
        console.log('Available headers:', headers);
        return;
    }

    console.log(`Processing ${data.length} rows from Google Sheet`);

    for (const row of data) {
        const sku = row[skuIndex];
        const iframeHtml = row[iframeHtmlIndex];

        if (!sku || !iframeHtml) {
            console.warn('Skipping row: Missing SKU or Iframe Link.');
            continue;
        }

        console.log(`Processing SKU: ${sku}, Iframe HTML provided`);

        const variant = await fetchVariantBySKU(sku);
        if (!variant) {
            console.warn(`SKU ${sku} not found in Shopify`);
            // Log missing SKU in the sheet and console
            await appendToMissingSKU(sku);
            continue;
        }

        console.log(`SKU found on store: ${sku}`);
        
        // Update videos tab with iframe HTML
        await updateVideosTab(variant.product.id, variant.product.descriptionHtml, iframeHtml, sku);

        await new Promise(resolve => setTimeout(resolve, 1000)); // Avoid hitting rate limits
    }
}

// Endpoint to trigger the videos update process
app.get('/update-videos', async (req, res) => {
    const range = 'Sheet1!A:B'; // A=SKU, B=Iframe Link
    try {
        await updateVideosFromSheet(range);
        res.send('Videos updated successfully');
    } catch (error) {
        console.error('Error while updating videos:', error);
        res.status(500).send('Error updating videos');
    }
});

// Start the server
const PORT = process.env.PORT || 8700;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT}/update-videos to start the update process`);
});
