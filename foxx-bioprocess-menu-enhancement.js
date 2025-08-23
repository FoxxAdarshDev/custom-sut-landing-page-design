
<script>
document.addEventListener('DOMContentLoaded', function() {
    // Enhanced Foxx Bioprocess menu functionality
    const foxxMenuItems = document.querySelectorAll('.foxx-bioprocess-highlight');
    const foxxLinks = document.querySelectorAll('.foxx-bioprocess-link');
    const foxxDropdowns = document.querySelectorAll('.foxx-bioprocess-dropdown');
    
    // Add enhanced hover effects
    foxxLinks.forEach(link => {
        link.addEventListener('mouseenter', function() {
            this.style.setProperty('--hover-scale', '1.05');
            
            // Add particle effect on hover (modern 2030 trend)
            createHoverParticles(this);
        });
        
        link.addEventListener('mouseleave', function() {
            this.style.setProperty('--hover-scale', '1');
        });
        
        // Add click analytics tracking
        link.addEventListener('click', function() {
            // Track Foxx Bioprocess menu clicks
            if (typeof gtag !== 'undefined') {
                gtag('event', 'foxx_bioprocess_menu_click', {
                    'event_category': 'navigation',
                    'event_label': this.textContent.trim()
                });
            }
            
            // Add visual feedback
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
    });
    
    // Enhanced dropdown behavior
    foxxMenuItems.forEach(menuItem => {
        const dropdown = menuItem.querySelector('.foxx-bioprocess-dropdown');
        if (dropdown) {
            menuItem.addEventListener('mouseenter', function() {
                dropdown.style.opacity = '0';
                dropdown.style.transform = 'translateY(-10px)';
                dropdown.style.display = 'block';
                
                requestAnimationFrame(() => {
                    dropdown.style.transition = 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                    dropdown.style.opacity = '1';
                    dropdown.style.transform = 'translateY(0)';
                });
            });
            
            menuItem.addEventListener('mouseleave', function() {
                dropdown.style.opacity = '0';
                dropdown.style.transform = 'translateY(-10px)';
                
                setTimeout(() => {
                    dropdown.style.display = 'none';
                }, 300);
            });
        }
    });
    
    // Create modern particle effect (2030 trend)
    function createHoverParticles(element) {
        const rect = element.getBoundingClientRect();
        const colors = ['#0071b9', '#005a94', '#ffffff'];
        
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const particle = document.createElement('div');
                particle.className = 'foxx-hover-particle';
                particle.style.cssText = `
                    position: fixed;
                    width: 4px;
                    height: 4px;
                    background: ${colors[Math.floor(Math.random() * colors.length)]};
                    border-radius: 50%;
                    pointer-events: none;
                    z-index: 1000;
                    left: ${rect.left + Math.random() * rect.width}px;
                    top: ${rect.top + Math.random() * rect.height}px;
                    animation: foxxParticleFloat 1s ease-out forwards;
                `;
                
                document.body.appendChild(particle);
                
                setTimeout(() => {
                    particle.remove();
                }, 1000);
            }, i * 50);
        }
    }
    
    // Add particle animation CSS
    if (!document.getElementById('foxx-particle-styles')) {
        const particleStyles = document.createElement('style');
        particleStyles.id = 'foxx-particle-styles';
        particleStyles.textContent = `
            @keyframes foxxParticleFloat {
                0% {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
                100% {
                    opacity: 0;
                    transform: translateY(-30px) scale(0);
                }
            }
        `;
        document.head.appendChild(particleStyles);
    }
    
    // Intersection Observer for scroll animations (2030 trend)
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'foxxSlideIn 0.6s ease-out';
            }
        });
    }, { threshold: 0.1 });
    
    foxxMenuItems.forEach(item => {
        observer.observe(item);
    });
    
    // Add slide-in animation CSS
    if (!document.getElementById('foxx-slide-styles')) {
        const slideStyles = document.createElement('style');
        slideStyles.id = 'foxx-slide-styles';
        slideStyles.textContent = `
            @keyframes foxxSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(slideStyles);
    }
    
    // Performance optimization: Debounce resize events
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Recalculate positions if needed
            foxxMenuItems.forEach(item => {
                item.style.transition = 'none';
                item.offsetHeight; // Trigger reflow
                item.style.transition = '';
            });
        }, 250);
    });
});
</script>
