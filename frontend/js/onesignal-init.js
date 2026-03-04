// frontend/js/onesignal-init.js

window.OneSignalDeferred = window.OneSignalDeferred || [];
OneSignalDeferred.push(async function(OneSignal) {
    await OneSignal.init({
        appId: "553381f2-480e-463c-a276-8bbce9288d11",
        allowLocalhostAsSecureOrigin: true, // Required for your 127.0.0.1 testing
        serviceWorkerParam: { scope: "/" },
        serviceWorkerPath: "OneSignalSDKWorker.js" 
    });

    // Automatically tag users based on their login data
    const dept = localStorage.getItem("userDept");
    const role = localStorage.getItem("userRole");

    if (dept) {
        OneSignal.User.addTag("dept_code", dept);
    }
    if (role) {
        OneSignal.User.addTag("user_role", role);
    }
    
    console.log("OneSignal initialized and user tagged.");
});