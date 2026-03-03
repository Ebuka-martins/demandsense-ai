// assets/src/cache-buster.js - Force cache refresh on version change
(function() {
    const APP_VERSION = '1.0.1';
    const STORAGE_KEY = 'app_version';
    const lastVersion = localStorage.getItem(STORAGE_KEY);
    
    console.log(`📱 App version: ${APP_VERSION}, Previous: ${lastVersion || 'none'}`);
    
    if (lastVersion !== APP_VERSION) {
        console.log(`🔄 Version changed from ${lastVersion} to ${APP_VERSION}, clearing caches...`);
        
        // Clear all service worker caches
        if ('caches' in window) {
            caches.keys().then(keys => {
                keys.forEach(key => {
                    if (key.startsWith('demandsense-')) {
                        console.log('🗑️ Deleting cache:', key);
                        caches.delete(key).then(success => {
                            if (success) console.log('✅ Deleted:', key);
                        });
                    }
                });
            });
        }
        
        // Clear any old localStorage items that might cause issues
        // Don't clear user preferences
        // localStorage.removeItem('some_old_data');
        
        // Update version
        localStorage.setItem(STORAGE_KEY, APP_VERSION);
        
        // Unregister old service workers
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                for (let registration of registrations) {
                    registration.unregister();
                    console.log('📴 Unregistered service worker');
                }
            });
        }
        
        // Force reload to get fresh assets
        console.log('🔄 Reloading page for fresh assets...');
        window.location.reload(true);
    } else {
        console.log('✅ App version is current');
    }
})();