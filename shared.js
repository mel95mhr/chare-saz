// ================================================================
// چاره‌ساز | shared.js
// فایل مشترک بین همه پنل‌ها
// ================================================================

// ================================================================
// ۱. کلیدهای مشترک LocalStorage
// ================================================================
const SHARED_KEYS = {
    USERS: 'chare_shared_users',
    EXPERTS: 'chare_shared_experts',
    ORDERS: 'chare_shared_orders',
    REVIEWS: 'chare_shared_reviews',
    VIOLATIONS: 'chare_shared_violations',
    CURRENT_CUSTOMER: 'chare_current_customer',
    CURRENT_EXPERT: 'chare_current_expert',
    CURRENT_ADMIN: 'chare_current_admin',
    NOTIFICATIONS: 'chare_shared_notifications'
};

// ================================================================
// ۲. توابع عمومی
// ================================================================
function getData(key) {
    try {
        return JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) {
        return [];
    }
}

function setData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        // ارسال رویداد به همه تب‌ها
        window.dispatchEvent(new CustomEvent('chare_data_changed', { detail: { key } }));
        return true;
    } catch (e) {
        return false;
    }
}

// ================================================================
// ۳. مدیریت کاربران (مشتریان)
// ================================================================
function getAllCustomers() {
    return getData(SHARED_KEYS.USERS);
}

function saveAllCustomers(users) {
    return setData(SHARED_KEYS.USERS, users);
}

function addCustomer(user) {
    const users = getAllCustomers();
    if (users.find(u => u.phone === user.phone)) {
        return { success: false, error: 'این شماره قبلاً ثبت شده' };
    }
    user.id = user.id || 'u_' + Date.now();
    user.createdAt = new Date().toISOString();
    users.push(user);
    saveAllCustomers(users);
    return { success: true, user };
}

function findCustomerByPhone(phone) {
    return getAllCustomers().find(u => u.phone === phone);
}

function getCurrentCustomer() {
    try {
        return JSON.parse(localStorage.getItem(SHARED_KEYS.CURRENT_CUSTOMER) || 'null');
    } catch (e) { return null; }
}

function setCurrentCustomer(user) {
    if (user) {
        localStorage.setItem(SHARED_KEYS.CURRENT_CUSTOMER, JSON.stringify(user));
    } else {
        localStorage.removeItem(SHARED_KEYS.CURRENT_CUSTOMER);
    }
}

// ================================================================
// ۴. مدیریت متخصصان
// ================================================================
function getAllExperts() {
    return getData(SHARED_KEYS.EXPERTS);
}

function saveAllExperts(experts) {
    return setData(SHARED_KEYS.EXPERTS, experts);
}

function addExpert(expert) {
    const experts = getAllExperts();
    if (experts.find(e => e.phone === expert.phone)) {
        return { success: false, error: 'این شماره قبلاً ثبت شده' };
    }
    expert.id = expert.id || 'e_' + Date.now();
    expert.createdAt = new Date().toISOString();
    expert.rating = 0;
    expert.completedOrders = 0;
    experts.push(expert);
    saveAllExperts(experts);
    return { success: true, expert };
}

function findExpertByPhone(phone) {
    return getAllExperts().find(e => e.phone === phone);
}

function getCurrentExpert() {
    try {
        return JSON.parse(localStorage.getItem(SHARED_KEYS.CURRENT_EXPERT) || 'null');
    } catch (e) { return null; }
}

function setCurrentExpert(expert) {
    if (expert) {
        localStorage.setItem(SHARED_KEYS.CURRENT_EXPERT, JSON.stringify(expert));
    } else {
        localStorage.removeItem(SHARED_KEYS.CURRENT_EXPERT);
    }
}

// ================================================================
// ۵. مدیریت سفارش‌ها (اتصال مشتری ↔ متخصص)
// ================================================================
function getAllOrders() {
    return getData(SHARED_KEYS.ORDERS);
}

function saveAllOrders(orders) {
    return setData(SHARED_KEYS.ORDERS, orders);
}

function createOrder(order) {
    const orders = getAllOrders();
    order.id = 'o_' + Date.now();
    order.createdAt = new Date().toISOString();
    order.status = 'pending';
    order.escrow = true;
    order.escrowReleased = false;
    orders.push(order);
    saveAllOrders(orders);

    // اطلاع به متخصص
    notifyExpert(order.expertId, {
        title: 'سفارش جدید',
        message: `سفارش جدید از ${order.customerName || 'مشتری'}`,
        orderId: order.id
    });

    return { success: true, order };
}

function getOrdersByCustomer(customerId) {
    return getAllOrders().filter(o => o.customerId === customerId);
}

function getOrdersByExpert(expertId) {
    return getAllOrders().filter(o => o.expertId === expertId);
}

function updateOrderStatus(orderId, newStatus) {
    const orders = getAllOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return { success: false, error: 'سفارش پیدا نشد' };
    
    orders[idx].status = newStatus;
    orders[idx].updatedAt = new Date().toISOString();
    
    if (newStatus === 'done') {
        orders[idx].completedAt = new Date().toISOString();
    }
    
    saveAllOrders(orders);

    // اطلاع‌رسانی
    const order = orders[idx];
    if (newStatus === 'confirmed') {
        notifyCustomer(order.customerId, {
            title: 'سفارش تأیید شد',
            message: `سفارش شما توسط متخصص تأیید شد`,
            orderId: order.id
        });
    } else if (newStatus === 'done') {
        notifyCustomer(order.customerId, {
            title: 'کار تمام شد',
            message: 'لطفاً کار متخصص را تأیید کنید',
            orderId: order.id
        });
    } else if (newStatus === 'cancelled') {
        notifyCustomer(order.customerId, {
            title: 'سفارش لغو شد',
            message: 'سفارش شما لغو شد',
            orderId: order.id
        });
    }
    
    return { success: true, order };
}

function releaseEscrow(orderId) {
    const orders = getAllOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return { success: false };
    
    orders[idx].escrowReleased = true;
    orders[idx].status = 'done';
    orders[idx].releasedAt = new Date().toISOString();
    saveAllOrders(orders);

    // واریز به کیف پول متخصص
    const expert = getAllExperts().find(e => e.id === orders[idx].expertId);
    if (expert) {
        const experts = getAllExperts();
        const eidx = experts.findIndex(e => e.id === expert.id);
        experts[eidx].wallet = (experts[eidx].wallet || 0) + (orders[idx].price || 0);
        experts[eidx].completedOrders = (experts[eidx].completedOrders || 0) + 1;
        saveAllExperts(experts);
    }

    return { success: true };
}

// ================================================================
// ۶. مدیریت نظرات
// ================================================================
function getAllReviews() {
    return getData(SHARED_KEYS.REVIEWS);
}

function addReview(review) {
    const reviews = getAllReviews();
    review.id = 'r_' + Date.now();
    review.createdAt = new Date().toISOString();
    reviews.push(review);
    setData(SHARED_KEYS.REVIEWS, reviews);

    // به‌روزرسانی امتیاز متخصص
    const expertReviews = reviews.filter(r => r.expertId === review.expertId);
    if (expertReviews.length > 0) {
        const avg = expertReviews.reduce((s, r) => s + r.rating, 0) / expertReviews.length;
        const experts = getAllExperts();
        const idx = experts.findIndex(e => e.id === review.expertId);
        if (idx !== -1) {
            experts[idx].rating = Math.round(avg * 10) / 10;
            saveAllExperts(experts);
        }
    }

    // اطلاع به متخصص
    notifyExpert(review.expertId, {
        title: 'نظر جدید',
        message: `نظر جدید با امتیاز ${review.rating}`,
        reviewId: review.id
    });

    return { success: true, review };
}

function getReviewsByExpert(expertId) {
    return getAllReviews().filter(r => r.expertId === expertId);
}

// ================================================================
// ۷. مدیریت تخلفات
// ================================================================
function getAllViolations() {
    return getData(SHARED_KEYS.VIOLATIONS);
}

function addViolation(violation) {
    const violations = getAllViolations();
    violation.id = 'v_' + Date.now();
    violation.createdAt = new Date().toISOString();
    violations.push(violation);
    setData(SHARED_KEYS.VIOLATIONS, violations);
    return { success: true, violation };
}

// ================================================================
// ۸. سیستم اطلاع‌رسانی
// ================================================================
function getAllNotifications() {
    return getData(SHARED_KEYS.NOTIFICATIONS);
}

function notify(userId, data) {
    const notifications = getAllNotifications();
    notifications.push({
        id: 'n_' + Date.now(),
        userId: userId,
        title: data.title || '',
        message: data.message || '',
        orderId: data.orderId || null,
        reviewId: data.reviewId || null,
        read: false,
        createdAt: new Date().toISOString()
    });
    setData(SHARED_KEYS.NOTIFICATIONS, notifications);
}

function notifyExpert(expertId, data) {
    notify(expertId, data);
}

function notifyCustomer(customerId, data) {
    notify(customerId, data);
}

function getNotificationsFor(userId) {
    return getAllNotifications()
        .filter(n => n.userId === userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function markNotificationRead(notifId) {
    const notifications = getAllNotifications();
    const idx = notifications.findIndex(n => n.id === notifId);
    if (idx !== -1) {
        notifications[idx].read = true;
        setData(SHARED_KEYS.NOTIFICATIONS, notifications);
    }
}

// ================================================================
// ۹. همگام‌سازی خودکار
// ================================================================
function syncData() {
    // ارسال رویداد برای به‌روزرسانی همه صفحه‌ها
    window.dispatchEvent(new CustomEvent('chare_data_changed', { detail: { key: 'all' } }));
}

// گوش دادن به تغییرات از تب‌های دیگر
window.addEventListener('storage', function(e) {
    if (e.key && e.key.startsWith('chare_')) {
        window.dispatchEvent(new CustomEvent('chare_data_changed', { detail: { key: e.key } }));
    }
});

// ================================================================
// ۱۰. آمار کلی (برای مدیریت)
// ================================================================
function getSystemStats() {
    const users = getAllCustomers();
    const experts = getAllExperts();
    const orders = getAllOrders();
    const reviews = getAllReviews();
    const violations = getAllViolations();

    const totalIncome = orders
        .filter(o => o.status === 'done')
        .reduce((s, o) => s + (o.price || 0), 0);

    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const activeOrders = orders.filter(o => o.status === 'confirmed').length;
    const doneOrders = orders.filter(o => o.status === 'done').length;
    const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;

    return {
        totalUsers: users.length,
        totalExperts: experts.length,
        totalOrders: orders.length,
        totalReviews: reviews.length,
        totalViolations: violations.length,
        totalIncome: totalIncome,
        pendingOrders: pendingOrders,
        activeOrders: activeOrders,
        doneOrders: doneOrders,
        cancelledOrders: cancelledOrders
    };
}

// ================================================================
// ۱۱. توابع کمکی
// ================================================================
function formatPrice(amount) {
    if (!amount && amount !== 0) return '۰ تومان';
    return Number(amount).toLocaleString('fa-IR') + ' تومان';
}

function formatDate(dateString) {
    try {
        const d = new Date(dateString);
        return d.toLocaleDateString('fa-IR');
    } catch (e) {
        return dateString;
    }
}

function formatDateTime(dateString) {
    try {
        const d = new Date(dateString);
        return d.toLocaleDateString('fa-IR') + ' - ' + d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return dateString;
    }
}

// ================================================================
// ۱۲. آماده‌سازی برای export (اگر در آینده لازم شد)
// ================================================================
console.log('✅ چاره‌ساز shared.js بارگذاری شد.');
console.log('📦 کلیدهای مشترک:', Object.keys(SHARED_KEYS).length);

