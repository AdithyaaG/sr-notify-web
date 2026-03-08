// frontend/js/onesignal-init.js
window.OneSignalDeferred = window.OneSignalDeferred || [];
OneSignalDeferred.push(async function(OneSignal) {
    await OneSignal.init({
        appId: "553381f2-480e-463c-a276-8bbce9288d11",
        allowLocalhostAsSecureOrigin: true,
        // FIXED: Pointing back to the root folder from your nested pages
        serviceWorkerPath: "../../OneSignalSDKWorker.js", 
        serviceWorkerParam: { scope: "/" }
    });

    const dept = localStorage.getItem("userDept");
    const role = localStorage.getItem("userRole");
    const email = localStorage.getItem("userEmail");

    // Login the user to OneSignal using their email as a unique ID
    if (email) {
        await OneSignal.login(email);
    }

    // Correct v16 Tagging syntax
    if (dept) {
        OneSignal.User.addTag("dept_code", dept);
    }
    if (role) {
        OneSignal.User.addTag("user_role", role);
    }
    
    console.log("OneSignal v16 initialized with correct root pathing.");
});