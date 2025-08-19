
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

// Function to update datasheet link in product description
async function updateDatasheetLink(productId, currentDescriptionHtml, newPdfLink, sku) {
    // Check if the documentation tab exists
    if (!currentDescriptionHtml.includes('id="documentation"')) {
        console.log(`Product ${sku} does not have a documentation tab - skipping`);
        return;
    }

    // Extract the documentation tab content
    const docTabRegex = /<div[^>]*id="documentation"[^>]*>(.*?)<\/div>/s;
    const docTabMatch = currentDescriptionHtml.match(docTabRegex);
    
    if (!docTabMatch) {
        console.log(`Could not find documentation tab content for SKU: ${sku}`);
        return;
    }

    const docTabContent = docTabMatch[1];
    
    // Find the first <a> tag in the documentation tab
    const firstLinkRegex = /<a\s+[^>]*href="[^"]*"[^>]*>.*?<\/a>/i;
    const firstLinkMatch = docTabContent.match(firstLinkRegex);
    
    if (!firstLinkMatch) {
        console.log(`No datasheet link found in documentation tab for SKU: ${sku}`);
        return;
    }

    const oldLink = firstLinkMatch[0];
    
    // Extract the link text from the old link
    const linkTextRegex = />([^<]+)</;
    const linkTextMatch = oldLink.match(linkTextRegex);
    const linkText = linkTextMatch ? linkTextMatch[1] : 'Product Datasheet';
    
    // Create new link with the same text but new URL
    const newLink = `<a href="${newPdfLink}" target="_blank">${linkText}</a>`;
    
    // Replace the old link with the new one in the documentation tab
    const updatedDocTabContent = docTabContent.replace(firstLinkRegex, newLink);
    
    // Replace the entire documentation tab in the description
    const newDescriptionHtml = currentDescriptionHtml.replace(docTabRegex, `<div class="tab-content" id="documentation">${updatedDocTabContent}</div>`);

    // Check if the link was actually changed
    if (currentDescriptionHtml === newDescriptionHtml) {
        console.log(`No changes needed for SKU: ${sku} - link already up to date`);
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

    const variables = {
        input: {
            id: productId,
            descriptionHtml: newDescriptionHtml,
        }
    };

    try {
        console.log(`Updating datasheet link for SKU: ${sku}`);
        console.log(`Old link: ${oldLink}`);
        console.log(`New link: ${newLink}`);

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

        console.log(`Successfully updated datasheet link for SKU: ${sku}`);
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
    
    // Remove the "To be loaded" paragraph
    const updatedContent = videosTabContent.replace(/<p>To be loaded<\/p>\s*/i, '');
    
    // Use the provided iframe HTML directly
    const finalContent = iframeHtml + '\n' + updatedContent;
    
    // Replace the entire videos tab in the description
    const newDescriptionHtml = currentDescriptionHtml.replace(videosTabRegex, `<div class="tab-content" id="videos">${finalContent}</div>`);

    // Check if the content was actually changed
    if (currentDescriptionHtml === newDescriptionHtml) {
        console.log(`No changes needed for SKU: ${sku} - videos tab already up to date`);
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

    const variables = {
        input: {
            id: productId,
            descriptionHtml: newDescriptionHtml,
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

// Main function to update datasheet links from Google Sheet
async function updateDatasheetLinksFromSheet(range) {
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
    const pdfLinkIndex = headers.indexOf('Pdf Link');
    const iframeHtmlIndex = headers.indexOf('Iframe HTML'); // Column for full iframe HTML

    if (skuIndex === -1 || pdfLinkIndex === -1) {
        console.error('Required columns (SKU, Pdf Link) not found in Google Sheet');
        console.log('Available headers:', headers);
        return;
    }

    console.log(`Processing ${data.length} rows from Google Sheet`);

    for (const row of data) {
        const sku = row[skuIndex];
        const pdfLink = row[pdfLinkIndex];
        const iframeHtml = iframeHtmlIndex !== -1 ? row[iframeHtmlIndex] : null;

        if (!sku || !pdfLink) {
            console.warn('Skipping row: Missing SKU or PDF link.');
            continue;
        }

        console.log(`Processing SKU: ${sku}, PDF Link: ${pdfLink}${iframeHtml ? `, Iframe HTML provided` : ''}`);

        const variant = await fetchVariantBySKU(sku);
        if (!variant) {
            console.warn(`SKU ${sku} not found in Shopify`);
            // Log missing SKU in the sheet and console
            await appendToMissingSKU(sku);
            continue;
        }

        console.log(`SKU found on store: ${sku}`);
        
        // Update datasheet link
        await updateDatasheetLink(variant.product.id, variant.product.descriptionHtml, pdfLink, sku);
        
        // Update videos tab if iframe HTML is provided
        if (iframeHtml && iframeHtml.trim()) {
            // Fetch updated product description after datasheet update
            const updatedVariant = await fetchVariantBySKU(sku);
            if (updatedVariant) {
                await updateVideosTab(updatedVariant.product.id, updatedVariant.product.descriptionHtml, iframeHtml, sku);
            }
        }

        await new Promise(resolve => setTimeout(resolve, 1000)); // Avoid hitting rate limits
    }
}

// Endpoint to trigger the datasheet link and videos update process
app.get('/update-datasheet-links', async (req, res) => {
    const range = 'Sheet1!A:C'; // Adjust the range as per your sheet (A=SKU, B=PDF Link, C=Iframe HTML)
    try {
        await updateDatasheetLinksFromSheet(range);
        res.send('Datasheet links and videos updated successfully');
    } catch (error) {
        console.error('Error while updating datasheet links and videos:', error);
        res.status(500).send('Error updating datasheet links and videos');
    }
});

// Start the server
const PORT = process.env.PORT || 8700;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT}/update-datasheet-links to start the update process`);
});
