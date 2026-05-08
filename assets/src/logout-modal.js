// Logout Modal Functionality
class LogoutManager {
    constructor() {
        this.modal = document.getElementById('logoutModal');
        this.confirmBtn = document.getElementById('confirmLogoutBtn');
        this.cancelBtn = document.getElementById('cancelLogoutBtn');
        this.logoutBtn = document.getElementById('logoutBtn');
        this.init();
    }
    
    init() {
        // Add click event to logout button
        if (this.logoutBtn) {
            this.logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showModal();
            });
        }
        
        // Add click event to confirm button
        if (this.confirmBtn) {
            this.confirmBtn.addEventListener('click', () => {
                this.performLogout();
            });
        }
        
        // Add click event to cancel button
        if (this.cancelBtn) {
            this.cancelBtn.addEventListener('click', () => {
                this.hideModal();
            });
        }
        
        // Close modal when clicking overlay
        const overlay = document.querySelector('.logout-modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', () => {
                this.hideModal();
            });
        }
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isModalVisible()) {
                this.hideModal();
            }
        });
    }
    
    showModal() {
        if (this.modal) {
            this.modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            document.body.style.paddingRight = '0px'; // Prevent scrollbar jump
        }
    }
    
    hideModal() {
        if (this.modal) {
            this.modal.style.display = 'none';
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        }
    }
    
    isModalVisible() {
        return this.modal && this.modal.style.display === 'flex';
    }
    
    async performLogout() {
        // Show loading state on confirm button
        if (this.confirmBtn) {
            const originalText = this.confirmBtn.innerHTML;
            this.confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Logging out...</span>';
            this.confirmBtn.disabled = true;
            if (this.cancelBtn) this.cancelBtn.disabled = true;
            
            try {
                // Clear user session data
                localStorage.removeItem('currentUser');
                localStorage.removeItem('authToken');
                localStorage.removeItem('userToken');
                sessionStorage.clear();
                
                // Show success message using existing toast or create one
                if (window.app && window.app.showToast) {
                    window.app.showToast('success', 'Logged out successfully!');
                } else {
                    this.showToastMessage('Logged out successfully!', 'success');
                }
                
                // Redirect to login page
                setTimeout(() => {
                    window.location.href = '/login';
                }, 500);
            } catch (error) {
                console.error('Logout error:', error);
                if (window.app && window.app.showToast) {
                    window.app.showToast('error', 'Logout failed. Please try again.');
                } else {
                    this.showToastMessage('Logout failed. Please try again.', 'error');
                }
                this.confirmBtn.innerHTML = originalText;
                this.confirmBtn.disabled = false;
                if (this.cancelBtn) this.cancelBtn.disabled = false;
            }
        }
    }
    
    showToastMessage(message, type = 'info') {
        // Try to use existing toast container
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-icon">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="toast-message">${message}</div>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s forwards';
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 300);
        }, 3000);
    }
}

// Initialize logout manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if not on login page
    if (window.location.pathname !== '/login') {
        new LogoutManager();
    }
});

// Initialize logout manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if not on login page and if the logout button exists
    if (window.location.pathname !== '/login') {
        // Small delay to ensure DOM is fully ready
        setTimeout(() => {
            new LogoutManager();
        }, 100);
    }
});