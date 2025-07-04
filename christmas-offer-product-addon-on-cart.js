<!-- christmas promo script to add lab rats item on cart -->

<script>
document.addEventListener('DOMContentLoaded', function () {
    const addToCartButtons = document.querySelectorAll('.btn.custombfs_sale');

    addToCartButtons.forEach(button => {
        button.addEventListener('click', async function (event) {
            event.preventDefault();

            if (this.getAttribute('data-processing') === 'true') {
                return;
            }

            this.setAttribute('data-processing', 'true');

            const form = document.getElementById('AddToCartForm');
            const selectedVariantId = form.querySelector('#productSelect').value;
            const qty = parseInt(this.getAttribute('data-qty'), 10) || 1; // Default quantity to 1 if not provided

            try {
                await addItemToCart(selectedVariantId, qty);
                console.log(`Product ${selectedVariantId} with quantity ${qty} added to cart`);
                await showNotification('Product added to cart!', true);
                await updateCartCount();
                await updateCartDisplay();
            } catch (error) {
                console.error('Error processing cart:', error);
            } finally {
                this.removeAttribute('data-processing');
            }
        });
    });

    async function addItemToCart(variantId, quantity) {
        const formData = new FormData();
        formData.append('id', variantId);
        formData.append('quantity', quantity);

        try {
            const response = await fetch('/cart/add.js', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Failed to add item to cart');
            }

            const responseData = await response.json();
            console.log('Item added to cart:', responseData);
        } catch (error) {
            console.error('Error adding item to cart:', error);
        }
    }

    async function updateCartCount() {
        try {
            const response = await fetch('/cart.js');
            const cartData = await response.json();
            const cartCountElement = document.querySelector('.header-bar__cart-count');
            if (cartCountElement) {
                cartCountElement.textContent = cartData.item_count;
            }
        } catch (error) {
            console.error('Error updating cart count:', error);
        }
    }

    async function updateCartDisplay() {
        try {
            const response = await fetch('/cart.js');
            const cartData = await response.json();

            const viewCartButton = document.querySelector('#view-cart-button');
            if (cartData.item_count > 0) {
                if (!viewCartButton) {
                    createViewCartButton(cartData.item_count);
                } else {
                    viewCartButton.style.display = 'block';
                    const quantityLabel = document.querySelector('#cart-quantity-label');
                    if (quantityLabel) {
                        quantityLabel.textContent = cartData.item_count;
                    }
                }
            } else {
                if (viewCartButton) {
                    viewCartButton.style.display = 'none';
                }
            }
            cleanUpNotification();
        } catch (error) {
            console.error('Error updating cart display:', error);
        }
    }

    async function showNotification(message, showViewCart) {
        return new Promise((resolve) => {
            const notification = document.createElement('div');
            notification.id = 'notification-div'; // Assign an ID for easier reference
            notification.textContent = message;

            if (showViewCart) {
                createViewCartButton();
            }

            notification.style.position = 'fixed';
            notification.style.bottom = '20px';
            notification.style.right = '20px';
            notification.style.background = '#333';
            notification.style.color = '#fff';
            notification.style.padding = '10px';
            notification.style.borderRadius = '5px';
            notification.style.zIndex = '9999';
            document.body.appendChild(notification);

            setTimeout(() => {
                if (!showViewCart) {
                    notification.remove(); // Remove the notification div if showViewCart is false
                }
                resolve();
            }, 3000);
        });
    }

    function createViewCartButton(quantity = 0) {
        let viewCartButton = document.querySelector('#view-cart-button');
        if (!viewCartButton) {
            viewCartButton = document.createElement('button');
            viewCartButton.id = 'view-cart-button';
            viewCartButton.onclick = () => {
                window.location.href = '/cart';
            };

            viewCartButton.style.position = 'fixed';
            viewCartButton.style.bottom = '20px';
            viewCartButton.style.right = '20px';
            viewCartButton.style.padding = '5px 10px';
            viewCartButton.style.backgroundColor = '#333';
            viewCartButton.style.color = '#fff';
            viewCartButton.style.border = 'none';
            viewCartButton.style.cursor = 'pointer';
            viewCartButton.style.borderRadius = '5px';
            viewCartButton.style.zIndex = '9999';

            // Create span for quantity label
            const quantityLabel = document.createElement('span');
            quantityLabel.id = 'cart-quantity-label';
            quantityLabel.textContent = quantity;
            quantityLabel.style.background = '#0071ce';
            quantityLabel.style.color = 'white';
            quantityLabel.style.borderRadius = '50%';
            quantityLabel.style.padding = '0 6px';
            quantityLabel.style.marginLeft = '10px';

            viewCartButton.textContent = 'View Cart';
            viewCartButton.appendChild(quantityLabel);
            document.body.appendChild(viewCartButton);
        } else {
            const quantityLabel = document.querySelector('#cart-quantity-label');
            if (quantityLabel) {
                quantityLabel.textContent = quantity;
            }
        }
    }

    function cleanUpNotification() {
        const notification = document.querySelector('#notification-div');
        if (notification) {
            notification.remove();
        }
    }

    // Ensure the view cart button visibility is set correctly on load
    updateCartDisplay();
});



</script>


<!-- christmas promo script to add lab rats item on cart -->
