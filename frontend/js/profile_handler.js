document.addEventListener('DOMContentLoaded', () => {
    // 1. Direct fetch with clear fallbacks to prevent "null" text from appearing
    const role = localStorage.getItem("userRole") || "";
    const name = localStorage.getItem("userName") || "User";
    const photo = localStorage.getItem("userPhoto") || "";
    const dept = localStorage.getItem("userDept") || "";
    const uid = localStorage.getItem("uid") || "";
    // Note: Student RegNo is stored as 'userReg' in your login_handler
    const regNo = localStorage.getItem("userReg") || "";

    // 2. Select Elements with high compatibility for Admin/Staff/Student HTML
    const nameDisp = document.getElementById('disp-name');
    const roleDisp = document.getElementById('disp-role');
    const deptDisp = document.getElementById('disp-dept');
    const idDisp = document.getElementById('disp-id');
    const badge = document.getElementById('badge-role');
    
    // Avatar logic: checks for both specific IDs and general classes
    const mainAvatar = document.getElementById('profile-pic-container') || 
                       document.querySelector('.profile-avatar') ||
                       document.getElementById('profile-container');

    // 3. Update Text Content
    if (nameDisp) nameDisp.textContent = name;
    if (badge) badge.textContent = role.toUpperCase();
    
    if (roleDisp) {
        roleDisp.textContent = role.charAt(0).toUpperCase() + role.slice(1) + " Account";
    }

    // 4. Role-Specific Data Mapping
    if (role === 'student') {
        if (idDisp) idDisp.textContent = regNo || "Not Available";
        if (deptDisp) deptDisp.textContent = dept || "Not Assigned";
    } else if (role === 'admin') {
        if (deptDisp) deptDisp.textContent = "All Departments"; // Admins see all
        if (idDisp) idDisp.textContent = uid || "Administrator";
    } else {
        // Staff logic
        if (deptDisp) deptDisp.textContent = dept || "Not Assigned";
        if (idDisp) idDisp.textContent = uid || "Not Available";
    }

    // 5. Fix Avatar Rendering (for Admin and Staff Header)
    if (photo && photo !== "null" && photo !== "") {
        // Update main profile picture
        if (mainAvatar) {
            mainAvatar.innerHTML = `<img src="${photo}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            const icon = mainAvatar.querySelector('i');
            if (icon) icon.style.display = 'none';
        }

        // Update top-right header icon (if present in staff/admin home)
        const headerImg = document.getElementById('user-header-img');
        const headerIcon = document.getElementById('user-header-icon');
        if (headerImg) {
            headerImg.src = photo;
            headerImg.style.display = 'block';
            if (headerIcon) headerIcon.style.display = 'none';
        }
    }

    // 6. Logout Handler
    const logoutBtn = document.getElementById('logoutBtn') || document.querySelector('.btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm("Do you want to sign out?")) {
                localStorage.clear();
                window.location.href = "../../login.html";
            }
        });
    }
});