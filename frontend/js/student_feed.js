import { db } from './firebase-config.js';
import { 
    collection, query, where, orderBy, onSnapshot, doc, getDoc, setDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const noticeContainer = document.getElementById('notice-container');
const userEmail = localStorage.getItem("userEmail");
const rawId = localStorage.getItem("userReg") || ""; 
const studentRegNum = Number(rawId); 
const studentName = localStorage.getItem("userName") || "Student";

let activeIntervals = {};

// --- 1. WHATSAPP STYLE TIME FORMATTER ---
function formatWhatsAppTime(date) {
    if (!date) return "Just now";
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    const options = { hour: 'numeric', minute: '2-digit', hour12: true };
    const timeStr = date.toLocaleTimeString([], options);

    if (diffDays === 0) return `Today, ${timeStr}`;
    if (diffDays === 1) return `Yesterday, ${timeStr}`;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
}

// --- 2. LIVE COUNTDOWN TIMER LOGIC ---
function startCountdown(id, expiryDate) {
    if (activeIntervals[id]) clearInterval(activeIntervals[id]);
    
    activeIntervals[id] = setInterval(() => {
        const timeLeft = expiryDate - new Date();
        const el = document.getElementById(`time-text-${id}`);
        const card = document.getElementById(`notice-card-${id}`);

        if (timeLeft <= 0) {
            if (card) card.style.opacity = "0.5"; 
            if (el) el.innerText = "Expired";
            clearInterval(activeIntervals[id]);
            return;
        }

        const mins = Math.floor((timeLeft / 1000 / 60) % 60);
        const secs = Math.floor((timeLeft / 1000) % 60);
        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        
        if (el) el.innerText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m ${secs}s`;
    }, 1000);
}

async function startFeed() {
    let myDept = "";
    let myClass = "";
    let activeTargets = [];

    // Get User Profile for Filtering
    try {
        if (userEmail) {
            const userSnap = await getDoc(doc(db, "users", userEmail.toLowerCase().trim()));
            if (userSnap.exists()) {
                const userData = userSnap.data();
                myDept = userData.dept_code || "";
                myClass = userData.batch || "";
            }
        }
    } catch (e) { console.error("Profile fetch error:", e); }

    // Fallback Logic
    if (rawId.length >= 8) {
        const year = rawId.substring(0, 2);
        const dept = rawId.substring(2, 5);
        if (!myClass) activeTargets.push(`${dept}_${year}_Batch_UG-S1`, `${dept}_${year}_Batch_UG-S2`);
        else activeTargets.push(myClass);
        if (!myDept) myDept = dept;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const filterType = urlParams.get('filter'); 
    if (filterType === "OFFICIAL") activeTargets = ["ALL"];
    else if (filterType === "DEPT") activeTargets = [myDept];
    activeTargets = activeTargets.filter(t => t && t !== "");

    if (activeTargets.length === 0) return;

    const q = query(collection(db, "notices"), where("targetCode", "in", activeTargets), orderBy("createdAt", "desc"));

    onSnapshot(q, async (snapshot) => {
        Object.values(activeIntervals).forEach(clearInterval);
        activeIntervals = {};

        if (!noticeContainer) return;
        noticeContainer.innerHTML = ''; 
        
        if (snapshot.empty) {
            noticeContainer.innerHTML = `<p style="text-align:center; padding:40px; color:#999;">No notices found.</p>`;
            return;
        }

        let lastProcessedDateString = "";
        const now = new Date();
        const twoDaysFromNow = new Date();
        twoDaysFromNow.setDate(now.getDate() + 2);

        for (const docSnap of snapshot.docs) {
            const notice = docSnap.data();
            const id = docSnap.id;

            // Expiry Check
            const expiryDate = notice.expiresAt?.toDate ? notice.expiresAt.toDate() : (notice.expiresAt ? new Date(notice.expiresAt) : null);
            if (expiryDate && expiryDate <= now) continue;

            // Range Check
            const start = Number(notice.start_reg);
            const end = Number(notice.end_reg);
            if (start && end && (studentRegNum < start || studentRegNum > end)) continue;

            // --- NEW: READ/UNREAD CHECK ---
            let isRead = false;
            try {
                const viewSnap = await getDoc(doc(db, "notices", id, "views", rawId));
                if (viewSnap.exists()) isRead = true;
            } catch (e) { console.error("Read status check error:", e); }

            // Visual Logic for Unread vs Read
            const cardBg = isRead ? "white" : "#4b4c4d00"; // Light gray for unread
            const cardOpacity = isRead ? "1" : "0.5";
            const unreadBadge = isRead ? '' : `<div style="position:absolute; top:10px; right:10px; width:8px; height:8px; background:#1a237e; border-radius:50%;"></div>`;

            // Colors and Icons
            const adminRed = "#d32f2f";
            const pinOrange = "#ff9800";
            const staffBlue = "#1a237e";
            let isPinned = false;

            if (notice.event_date) {
                const eventDate = new Date(notice.event_date);
                if (eventDate <= twoDaysFromNow && eventDate >= new Date().setHours(0,0,0,0)) isPinned = true;
            }

            let accentColor = notice.authorRole === "admin" ? adminRed : staffBlue;
            if (isPinned || (notice.priority && notice.priority.toLowerCase().includes('event'))) accentColor = pinOrange;

            const postDate = notice.createdAt?.toDate ? notice.createdAt.toDate() : (notice.createdAt ? new Date(notice.createdAt) : new Date());
            const currentNoticeDateString = postDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-') + " " + postDate.toLocaleDateString('en-US', { weekday: 'long' });

            if (currentNoticeDateString !== lastProcessedDateString) {
                const dateSeparator = document.createElement('div');
                dateSeparator.style = "width: 100%; border-top: 2px solid #333; margin: 30px 0 15px; position: relative; clear: both;";
                dateSeparator.innerHTML = `<span style="position: absolute; top: -14px; left: 10px; background: #f0f2f5; padding: 0 12px; font-weight: 800; color: #333; font-size: 0.9rem;">${currentNoticeDateString}</span>`;
                noticeContainer.appendChild(dateSeparator);
                lastProcessedDateString = currentNoticeDateString;
            }

            const timeSnap = formatWhatsAppTime(postDate);

            // Create Card Element
            const card = document.createElement('div');
            card.className = "notice-card";
            card.id = `notice-card-${id}`;
            card.onclick = () => showNoticePopup(id);
            card.style = `background:${cardBg}; opacity:${cardOpacity}; padding:20px; border-radius:18px; margin-bottom:15px; border-left:8px solid ${accentColor}; box-shadow: 0 8px 20px rgba(0,0,0,0.06); border: 1px solid #f0f0f0; position:relative; cursor:pointer; transition: all 0.3s ease;`;
            
            card.innerHTML = `
                ${unreadBadge}
                ${isPinned ? `<div style="position:absolute; top:-10px; right:15px; background:${pinOrange}; color:white; font-size:0.6rem; padding:2px 8px; border-radius:4px; font-weight:bold;"><i class="fas fa-thumbtack"></i> UPCOMING</div>` : ''}

                <h3 style="font-weight:900; color:${accentColor}; font-size:1.15rem; margin:0; text-transform: capitalize;">
                    <i class="fas ${notice.event_date ? 'fa-calendar-star' : (notice.authorRole === 'admin' ? 'fa-shield-alt' : 'fa-info-circle')}"></i> 
                    ${notice.title}
                </h3>

                <p style="color:#444; font-size:0.95rem; line-height:1.5; margin:12px 0;">${notice.content}</p>
                
                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f5f5f5; padding-top:12px;">
                    <div style="font-size:0.75rem; color:#888;">
                        <i class="fas ${notice.authorRole === 'admin' ? 'fa-user-shield' : 'fa-user-circle'}"></i> 
                        <b>${notice.authorName || 'Official'}</b> • ${timeSnap}
                    </div>
                    
                    ${expiryDate ? `
                        <div style="font-size:0.7rem; color:${adminRed}; font-weight:bold;">
                            <i class="fas fa-hourglass-half"></i> <span id="time-text-${id}">Calculating...</span>
                        </div>
                    ` : `
                        <span style="background:${accentColor}; color:white; padding:2px 10px; border-radius:6px; font-size:0.65rem; font-weight:bold; text-transform:uppercase;">
                            ${notice.priority || 'NORMAL'}
                        </span>
                    `}
                </div>`;

            noticeContainer.appendChild(card);
            if (expiryDate) startCountdown(id, expiryDate);
        }
    });

    if (window.OneSignalDeferred) {
        OneSignalDeferred.push(async function(OneSignal) {
            if (myDept) await OneSignal.User.addTag("dept_code", myDept);
        });
    }
}

// --- POPUP LOGIC ---
// --- POPUP LOGIC ---
// --- POPUP LOGIC ---
window.showNoticePopup = async function(id) {
    const docSnap = await getDoc(doc(db, "notices", id));
    if (!docSnap.exists()) return;
    const notice = docSnap.data();

    // Record View in Firestore
    try {
        await setDoc(doc(db, "notices", id, "views", rawId), { 
            viewerName: studentName, 
            viewedAt: serverTimestamp(), 
            studentId: rawId 
        }, { merge: true });
        
        // Immediate UI Update: Change card style once clicked
        const card = document.getElementById(`notice-card-${id}`);
        if (card) {
            card.style.background = "white";
            card.style.opacity = "1";
            const badge = card.querySelector('div[style*="border-radius:50%"]');
            if (badge) badge.remove();
        }
    } catch(e) { console.error("Error recording view:", e); }

    // Create Popup Overlay
    const overlay = document.createElement('div');
    overlay.id = "notice-overlay";
    overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); display:flex; align-items:center; justify-content:center; z-index:10000; padding:15px; backdrop-filter: blur(10px);";

    // Format content with clickable links
    const linkedContent = notice.content.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:#1a237e; font-weight:bold; text-decoration:underline;">$1</a>');
    
    // --- CORRECTED MEDIA HANDLING ---
    let mediaHtml = "";
    let items = [];

    // 1. Check for modern attachments array
    if (Array.isArray(notice.attachments) && notice.attachments.length > 0) {
        items = notice.attachments;
    } 
    // 2. Check for legacy single attachment URL
    else if (notice.attachmentUrl) {
        items.push({ 
            url: notice.attachmentUrl, 
            type: notice.attachmentType || 'image' // Default to image if type is missing
        });
    }

    if (items.length > 0) {
        mediaHtml = `<div style="margin-top:20px; display:flex; flex-direction:column; gap:15px;">
            ${items.map(item => {
                const url = item.url || item; // Handle if the array contains just strings
                const type = item.type || (url.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? 'image' : 'file');

                if (type === 'image') {
                    return `<div style="width:100%; border-radius:15px; overflow:hidden; border:1px solid #eee; background:#f9f9f9;">
                                <img src="${url}" style="width:100%; display:block; object-fit:contain; max-height:400px;" 
                                     onclick="window.open('${url}', '_blank')" alt="Attachment">
                            </div>`;
                }
                if (type === 'video') {
                    return `<video controls style="width:100%; border-radius:15px; max-height:400px;"><source src="${url}"></video>`;
                }
                // Default for PDF or other documents
                return `<a href="${url}" target="_blank" style="display:flex; align-items:center; gap:10px; padding:15px; background:#f0f2f5; border-radius:12px; text-decoration:none; color:#1a237e; border:1px solid #ddd;">
                            <i class="fas fa-file-alt" style="font-size:1.2rem;"></i> 
                            <span style="font-weight:600;">View Attached Document</span>
                        </a>`;
            }).join('')}
        </div>`;
    }

    overlay.innerHTML = `
        <div style="background:white; width:100%; max-width:450px; border-radius:28px; overflow:hidden; position:relative; box-shadow:0 20px 50px rgba(0,0,0,0.3); animation: slideUp 0.3s ease;">
            <div style="padding:20px; border-bottom:1px solid #f0f0f0; display:flex; justify-content:space-between; align-items:center;">
                <h2 style="margin:0; font-size:1.1rem; color:#1a237e; font-weight:800; max-width:80%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${notice.title}
                </h2>
                <button onclick="document.getElementById('notice-overlay').remove()" style="border:none; background:#f0f0f0; width:35px; height:35px; border-radius:50%; cursor:pointer; font-size:1.2rem; display:flex; align-items:center; justify-content:center;">&times;</button>
            </div>
            <div style="padding:20px; max-height:75vh; overflow-y:auto; scrollbar-width: thin;">
                <p style="white-space:pre-wrap; color:#333; line-height:1.6; font-size:1rem; margin-bottom:10px;">${linkedContent}</p>
                ${mediaHtml}
                <div style="margin-top:20px; font-size:0.75rem; color:#888; border-top:1px solid #f9f9f9; padding-top:10px;">
                    Posted by ${notice.authorName} • ${notice.authorRole.toUpperCase()}
                </div>
            </div>
        </div>
        <style>
            @keyframes slideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        </style>`;
    document.body.appendChild(overlay);
};

startFeed();