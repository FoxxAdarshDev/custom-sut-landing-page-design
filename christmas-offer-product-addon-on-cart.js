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

    function showConfetti() {
        const canvas = document.getElementById('confetti-canvas');
        const overlay = document.getElementById('overlay');
        
        if (!canvas || !overlay) return;
        
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        // Show overlay and canvas
        overlay.style.display = 'block';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
        overlay.style.zIndex = '9998';
        overlay.style.pointerEvents = 'none';
        
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.zIndex = '9999';
        canvas.style.pointerEvents = 'none';
        canvas.style.display = 'block';
        
        const confetti = [];
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd', '#98d8c8'];
        
        // Create confetti particles
        for (let i = 0; i < 100; i++) {
            confetti.push({
                x: Math.random() * canvas.width,
                y: -10,
                vx: Math.random() * 6 - 3,
                vy: Math.random() * 3 + 2,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: Math.random() * 8 + 4,
                rotation: Math.random() * 360,
                rotationSpeed: Math.random() * 10 - 5
            });
        }
        
        function animateConfetti() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            for (let i = confetti.length - 1; i >= 0; i--) {
                const particle = confetti[i];
                
                // Update position
                particle.x += particle.vx;
                particle.y += particle.vy;
                particle.rotation += particle.rotationSpeed;
                
                // Apply gravity
                particle.vy += 0.3;
                
                // Draw particle
                ctx.save();
                ctx.translate(particle.x, particle.y);
                ctx.rotate(particle.rotation * Math.PI / 180);
                ctx.fillStyle = particle.color;
                ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
                ctx.restore();
                
                // Remove particles that are off screen
                if (particle.y > canvas.height + 100) {
                    confetti.splice(i, 1);
                }
            }
            
            if (confetti.length > 0) {
                requestAnimationFrame(animateConfetti);
            } else {
                // Hide confetti after animation ends
                setTimeout(() => {
                    canvas.style.display = 'none';
                    overlay.style.display = 'none';
                }, 500);
            }
        }
        
        animateConfetti();
    }

    async function showNotification(message, showViewCart) {
        // Show confetti when notification is shown
        showConfetti();
        
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
