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

// Function to update a product description in Shopify
async function updateShopifyDescription(productId, currentDescriptionHtml, amazonLink) {
    // Check if the current description already contains the Amazon link
    if (currentDescriptionHtml.includes(amazonLink)) {
        console.log(`The Amazon link has already been added to product ID: ${productId}`);
        return;
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

    const newDescriptionHtml = `${currentDescriptionHtml}<br><a rel="noopener noreferrer" href="${amazonLink}" style="color: #0071ba; text-decoration: underline;" target="_blank">Also Available on Amazon</a>`;

    const variables = {
        input: {
            id: productId,
            descriptionHtml: newDescriptionHtml,
        }
    };

    try {
        console.log(`Updating product description for ID: ${productId}`);

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

       // console.log(`Successfully updated product ${productId}. New Description: ${newDescriptionHtml}`);
    } catch (error) {
        console.error('Error updating product description:', error);
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

// Main function to update Shopify descriptions from Google Sheet
async function updateDescriptionsFromSheet(range) {
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
    const amazonLinkIndex = headers.indexOf('Amazon Link');

    if (skuIndex === -1 || amazonLinkIndex === -1) {
        console.error('Required columns not found in Google Sheet');
        return;
    }

    for (const row of data) {
        const sku = row[skuIndex];
        const amazonLink = row[amazonLinkIndex];

        if (!sku || !amazonLink) {
            console.warn('Skipping row: Missing SKU or Amazon link.');
            continue;
        }

       //console.log(`Processing SKU: ${sku}, Amazon Link: ${amazonLink}`);

        const variant = await fetchVariantBySKU(sku);
        if (!variant) {
            console.warn(`SKU ${sku} not found in Shopify`);
            // Log missing SKU in the sheet and console
            await appendToMissingSKU(sku);
            continue;
        }

        console.log(`SKU found on store: ${sku}`);
        await updateShopifyDescription(variant.product.id, variant.product.descriptionHtml, amazonLink);

        await new Promise(resolve => setTimeout(resolve, 1000)); // Avoid hitting rate limits
    }
}

// Endpoint to trigger the description update process
app.get('/update-amazon-link', async (req, res) => {
    const range = 'Sheet1!A:B'; // Adjust the range as per your sheet (assuming A is SKU and B is Amazon Link)
    try {
        await updateDescriptionsFromSheet(range);
        res.send('Descriptions updated successfully');
    } catch (error) {
        console.error('Error while updating descriptions:', error);
        res.status(500).send('Error updating descriptions');
    }
});

// Start the server
const PORT = process.env.PORT || 8700;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
