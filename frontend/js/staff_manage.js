import { db, auth } from './firebase-config.js';
import { 
    collection, query, where, orderBy, onSnapshot, doc, getDoc, 
    updateDoc, deleteDoc, Timestamp, serverTimestamp, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const container = document.getElementById('notice-list-container');
const CLOUD_NAME = "dfie8haie"; 
const UPLOAD_PRESET = "sr_notices"; 
let activeIntervals = {};

// --- HELPER: CLOUDINARY UPLOAD ---
async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    const statusText = document.getElementById('edit-upload-status');
    if (statusText) statusText.style.display = 'block';

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (statusText) statusText.style.display = 'none';
        return { url: data.secure_url, type: data.resource_type };
    } catch (error) {
        if (statusText) statusText.style.display = 'none';
        return null;
    }
}

// --- REAL-TIME LISTENER ---
auth.onAuthStateChanged((user) => {
    if (user) {
        const q = query(collection(db, "notices"), where("authorEmail", "==", user.email), orderBy("createdAt", "desc"));

        onSnapshot(q, (snapshot) => {
            if (!container) return;
            Object.values(activeIntervals).forEach(clearInterval);
            container.innerHTML = ''; 

            snapshot.forEach((snapDoc) => {
                const data = snapDoc.data();
                const id = snapDoc.id;
                
                // FIXED: Flexible check for "Event" in priority
                const isEvent = data.priority && data.priority.toLowerCase().includes("event");
                const accentColor = isEvent ? "#ff9800" : "#1a237e";
                
                const expiryDate = data.expiresAt?.toDate ? data.expiresAt.toDate() : (data.expiresAt ? new Date(data.expiresAt) : null);
                const isExpired = expiryDate && expiryDate <= new Date();

                container.innerHTML += `
                    <div class="notice-item" style="border-left: 6px solid ${isExpired ? '#999' : accentColor}; background: ${isEvent ? '#fffbf2' : 'white'}; padding: 15px; margin-bottom: 15px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #eee;">
                        <div class="notice-info" onclick="window.location.href='staff_analytics.html?id=${id}'" style="flex:1; cursor:pointer;">
                            <h4 style="color: ${accentColor}; margin: 0;">${isEvent ? '🎫 ' : ''}${data.title}</h4>
                            <p style="margin: 5px 0; font-size: 0.8rem; color: #777;">Target: ${data.targetCode || 'N/A'} | <span style="color:${accentColor};">Stats <i class="fas fa-chart-line"></i></span></p>
                            
                            ${isEvent && data.event_date ? `<div style="margin-top:5px;"><small style="color:#e65100; font-weight:bold;"><i class="fas fa-calendar-alt"></i> Event Date: ${data.event_date}</small></div>` : ''}
                            
                            <div id="timer-${id}" style="font-size:0.75rem; margin-top:5px; font-weight:bold; color:${isExpired ? 'red' : 'green'};"></div>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button onclick="openEditModal('${id}')" style="background:#e8f5e9; color:#2e7d32; border:none; padding:10px; border-radius:8px; cursor:pointer;"><i class="fas fa-edit"></i></button>
                            <button onclick="confirmDelete('${id}')" style="background:#ffebee; color:#c62828; border:none; padding:10px; border-radius:8px; cursor:pointer;"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>`;
                
                if (expiryDate) startTimer(id, expiryDate);
            });
        });
    } else { window.location.href = "../../index.html"; }
});

function startTimer(id, expiryDate) {
    activeIntervals[id] = setInterval(() => {
        const el = document.getElementById(`timer-${id}`);
        if (!el) return;
        const diff = expiryDate - new Date();
        if (diff <= 0) { el.innerText = "❌ EXPIRED"; clearInterval(activeIntervals[id]); return; }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        el.innerText = `⏳ ${h}h ${m}m left`;
    }, 1000);
}

// --- OPEN MODAL ---
window.openEditModal = async function(id) {
    try {
        const snap = await getDoc(doc(db, "notices", id));
        if (snap.exists()) {
            const data = snap.data();
            
            // FIXED: Use same flexible check for modal display
            const isEvent = data.priority && data.priority.toLowerCase().includes("event");

            const safeSet = (elId, val) => {
                const el = document.getElementById(elId);
                if (el) el.value = val || "";
            };

            safeSet('edit-id', id);
            safeSet('edit-title', data.title);
            safeSet('edit-content', data.content);

            const eventRow = document.getElementById('edit-event-row');
            if (eventRow) {
                eventRow.style.display = isEvent ? 'block' : 'none'; // Show row if it's an event
                safeSet('edit-event-date', data.event_date);
            }

            const expiryInput = document.getElementById('edit-expiry');
            if (expiryInput && data.expiresAt) {
                const date = data.expiresAt.toDate();
                expiryInput.value = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
            } else if (expiryInput) {
                expiryInput.value = "";
            }

            document.getElementById('edit-modal').style.display = 'flex';
        }
    } catch (err) { console.error("Error opening modal:", err); }
};

// --- SAVE CHANGES ---
window.saveEdit = async function() {
    const id = document.getElementById('edit-id').value;
    const btn = document.getElementById('save-edit-btn');
    if (!id) return;
    
    try {
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Updating...`;

        const updateData = {
            title: document.getElementById('edit-title').value,
            content: document.getElementById('edit-content').value,
            updatedAt: serverTimestamp()
        };

        const expiryVal = document.getElementById('edit-expiry')?.value;
        if (expiryVal) {
            updateData.expiresAt = Timestamp.fromDate(new Date(expiryVal));
        }

        // FIXED: Only save event_date if the field is visible
        const eventRow = document.getElementById('edit-event-row');
        if (eventRow && eventRow.style.display === 'block') {
            const eventDateVal = document.getElementById('edit-event-date').value;
            updateData.event_date = eventDateVal;
        }

        const fileInput = document.getElementById('edit-file-input');
        if (fileInput && fileInput.files[0]) {
            const media = await uploadToCloudinary(fileInput.files[0]);
            if (media) {
                updateData.attachmentUrl = media.url;
                updateData.attachmentType = media.type === 'image' ? 'image' : 'video';
            }
        }

        await updateDoc(doc(db, "notices", id), updateData);
        document.getElementById('edit-modal').style.display = 'none';
        alert("Notice updated successfully!");
    } catch (err) { 
        console.error("Update failed:", err);
        alert("Error updating notice."); 
    } finally { 
        btn.disabled = false; 
        btn.innerHTML = `<i class="fas fa-check-circle"></i> Save Changes`; 
    }
};

window.confirmDelete = async function(id) {
    if (confirm("Delete this notice permanently?")) {
        try {
            await deleteDoc(doc(db, "notices", id));
        } catch (err) { alert("Delete failed"); }
    }
};