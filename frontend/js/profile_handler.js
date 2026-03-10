document.addEventListener('DOMContentLoaded', () => {
    // 1. Fetch data from Local Storage
    const userData = {
        name: localStorage.getItem("userName"),
        role: localStorage.getItem("userRole"),
        photo: localStorage.getItem("userPhoto"),
        dept: localStorage.getItem("userDept"),
        deptName: localStorage.getItem("deptName"), // Fixed: Added missing comma
        regNo: localStorage.getItem("userReg") || localStorage.getItem("regNo"),
        uid: localStorage.getItem("uid")
    };

    // 2. Select UI Elements
    const elements = {
        name: document.getElementById('disp-name'),
        role: document.getElementById('disp-role'),
        deptCode: document.getElementById('disp-dept-code'), // Changed ID
        deptName: document.getElementById('disp-dept-name'), // New ID
        id: document.getElementById('disp-id'),
        badge: document.getElementById('badge-role'),
        
        mainAvatar: document.getElementById('profile-pic-container') || document.querySelector('.profile-avatar'),
        headerImg: document.getElementById('user-header-img'),
        headerIcon: document.getElementById('user-header-icon')
    };

    // 3. Populate Universal Text Details
    if (elements.name) elements.name.innerText = userData.name || "User";
    if (elements.badge) elements.badge.innerText = userData.role ? userData.role.toUpperCase() : "USER";
    
    if (elements.role) {
        elements.role.innerText = userData.role ? 
            userData.role.charAt(0).toUpperCase() + userData.role.slice(1) + " Account" : 
            "Account";
    }

    // 4. Role-Specific Logic
    if (userData.role === 'student') {
        if (elements.id) elements.id.innerText = userData.regNo || "Not Available";
        if (elements.deptCode) elements.deptCode.innerText = userData.dept || "---";
        if (elements.deptName) elements.deptName.innerText = userData.deptName || "Not Assigned";
    } else if (userData.role === 'admin') {
        if (elements.deptCode) elements.deptCode.innerText = "All";
        if (elements.deptName) elements.deptName.innerText = "Administrator Access";
        if (elements.id) elements.id.innerText = userData.uid || "Admin UID";
    } else {
        // Staff
        if (elements.deptCode) elements.deptCode.innerText = userData.dept || "---";
        if (elements.deptName) elements.deptName.innerText = userData.deptName || "Not Assigned";
        if (elements.id) elements.id.innerText = userData.uid || "Not Available";
    }

    // 5. Avatar Rendering
    if (userData.photo && userData.photo !== "null" && userData.photo !== "") {
        if (elements.mainAvatar) {
            elements.mainAvatar.innerHTML = `<img src="${userData.photo}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            const icon = elements.mainAvatar.querySelector('.fa-user-circle');
            if (icon) icon.style.display = 'none';
        }
        if (elements.headerImg) {
            elements.headerImg.src = userData.photo;
            elements.headerImg.style.display = 'block';
            if (elements.headerIcon) elements.headerIcon.style.display = 'none';
        }
    }

    // 6. Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = (e) => {
            e.preventDefault();
            if (confirm("Are you sure you want to sign out?")) {
                localStorage.clear();
                window.location.href = "../../login.html";
            }
        };
    }
});