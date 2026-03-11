import { db, auth } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const CLOUD_NAME = "dfie8haie"; 
const UPLOAD_PRESET = "sr_notices"; 

// 1. Cloudinary Upload Logic
async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) throw new Error('Upload failed');
        const data = await response.json();
        
        let type = data.resource_type; 
        if (file.type === 'application/pdf' || data.format === 'pdf') {
            type = 'document';
        }

        return { url: data.secure_url, type: type };
    } catch (error) {
        console.error("Cloudinary Error:", error);
        return null;
    }
}

// 2. Main Publish Function
window.publishDeptNotice = async function() {
    const userRole = localStorage.getItem("userRole");
    if (userRole !== "staff" && userRole !== "admin") {
        alert("Unauthorized!");
        return;
    }

    const title = document.getElementById('noticeTitle').value.trim();
    const content = document.getElementById('noticeContent').value.trim();
    const priority = document.getElementById('noticePriority').value;
    const eventDate = document.getElementById('eventDate').value; 
    const expiryInput = document.getElementById('expiryDate').value; // Get Expiry
    
    // FIXED ID HERE: matched to 'dept-file-input' in your HTML
    const fileInput = document.getElementById('dept-file-input');
    const files = fileInput ? Array.from(fileInput.files) : [];
    
    const user = auth.currentUser;
    if (!user) {
        alert("Authentication error. Please log in again.");
        return;
    }

    if (!title || !content) {
        alert("Please enter both Title and Content!");
        return;
    }

    const postBtn = document.querySelector('.btn-post');
    if (postBtn) {
        postBtn.disabled = true;
        postBtn.innerText = "UPLOADING...";
    }

    let attachments = [];
    if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
            if (postBtn) postBtn.innerText = `UPLOADING (${i + 1}/${files.length})...`;
            const data = await uploadToCloudinary(files[i]);
            if (data) attachments.push(data);
        }
    }

    const finalTargetCode = localStorage.getItem("userDept") || ""; 
    const authorName = localStorage.getItem("userName") || "Staff Member";
    const deptName = localStorage.getItem("deptName") || "Department";

    try {
        if (postBtn) postBtn.innerText = "FINALIZING...";

        await addDoc(collection(db, "notices"), {
            title: title,
            content: content,
            priority: priority,
            event_date: eventDate || null, 
            authorName: authorName,
            authorEmail: user.email,
            authorRole: "staff",
            targetCode: finalTargetCode,
            targetType: "department_wide",
            deptName: deptName,
            attachments: attachments, 
            createdAt: serverTimestamp(),
            // Convert expiry string to Date object for Firestore
            expiresAt: expiryInput ? new Date(expiryInput) : null 
        });

        alert("Notice successfully posted!");
        window.location.href = "staff_home.html"; 
    } catch (error) {
        console.error("Firestore Error:", error);
        alert("Failed: " + error.message);
        if (postBtn) {
            postBtn.disabled = false;
            postBtn.innerText = "POST";
        }
    }
};