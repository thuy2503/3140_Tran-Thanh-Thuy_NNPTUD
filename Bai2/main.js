// main.js - Xử lý logic backend và kết nối với JSON Server

// Cấu hình kết nối JSON Server
const API_URL = 'http://localhost:3000'; // Đảm bảo bạn đã khởi động json-server

// State quản lý
let posts = [];
let comments = [];
let currentPostId = '';
let currentCommentId = '';
let currentFilter = 'all';

// Khởi động ứng dụng
document.addEventListener('DOMContentLoaded', function() {
    loadPosts();
    loadComments();
    updatePostSelect();
    updateStats();
    
    // Cập nhật thống kê mỗi 5 giây
    setInterval(updateStats, 5000);
});

// Hàm gọi API
async function fetchApi(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        alert('Lỗi kết nối đến máy chủ. Vui lòng kiểm tra lại.');
        return null;
    }
}

// Post functions
async function loadPosts() {
    const postsList = document.getElementById('postsList');
    postsList.innerHTML = '<p>Đang tải dữ liệu...</p>';

    posts = await fetchApi('/posts');
    if (!posts) return;

    // Lọc posts theo filter
    let filteredPosts = [...posts];
    
    if (currentFilter === 'active') {
        filteredPosts = filteredPosts.filter(p => !p.isDeleted);
    } else if (currentFilter === 'deleted') {
        filteredPosts = filteredPosts.filter(p => p.isDeleted);
    }
    
    // Tìm kiếm
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    if (searchTerm) {
        filteredPosts = filteredPosts.filter(p => 
            p.title.toLowerCase().includes(searchTerm)
        );
    }
    
    // Sắp xếp
    const sortBy = document.getElementById('sortBy').value;
    if (sortBy === 'views') {
        filteredPosts.sort((a, b) => (b.views || 0) - (a.views || 0));
    } else if (sortBy === 'title') {
        filteredPosts.sort((a, b) => a.title.localeCompare(b.title));
    }

    if (filteredPosts.length === 0) {
        postsList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Không tìm thấy post nào</p>';
        return;
    }

    postsList.innerHTML = '';
    filteredPosts.forEach(post => {
        const postDiv = document.createElement('div');
        postDiv.className = `post ${post.isDeleted ? 'deleted-post' : ''}`;
        postDiv.innerHTML = `
            <div class="post-title" onclick="togglePostContent('${post.id}')">
                ${post.title}
                <span class="post-views">👁️ ${post.views || 0}</span>
                ${post.isDeleted ? '<span style="color: #f5576c; font-size: 0.8em; margin-left: 10px;">(Đã xóa)</span>' : ''}
            </div>
            <div class="post-content" id="content-${post.id}" style="display: none;">
                <strong>ID:</strong> ${post.id}<br>
                <strong>Views:</strong> ${post.views || 0}<br>
                <strong>Tạo lúc:</strong> ${formatDate(post.createdAt)}<br>
                ${post.updatedAt ? `<strong>Cập nhật:</strong> ${formatDate(post.updatedAt)}<br>` : ''}
                ${post.isDeleted && post.deletedAt ? `<strong>Xóa lúc:</strong> ${formatDate(post.deletedAt)}<br>` : ''}
            </div>
            <div class="post-actions">
                ${post.isDeleted ? 
                    `<button class="restore" onclick="restorePost('${post.id}')">↪️ Khôi phục</button>` : 
                    `<button class="edit" onclick="editPost('${post.id}')">✏️ Sửa</button>
                     <button class="delete" onclick="softDeletePost('${post.id}')">🗑️ Xóa</button>
                     <button class="views" onclick="incrementViews('${post.id}')">👁️ +1 View</button>`}
                ${post.isDeleted ? '' : `<button onclick="viewComments('${post.id}')">💬 Comments (${getCommentCount(post.id)})</button>`}
            </div>
            ${!post.isDeleted ? `<div class="comments-section" id="comments-${post.id}" style="display: none;"></div>` : ''}
        `;
        postsList.appendChild(postDiv);
    });
}

async function savePost() {
    const title = document.getElementById('postTitle').value.trim();
    const views = document.getElementById('postViews').value.trim();

    if (!title) {
        alert('Vui lòng nhập tiêu đề post!');
        return;
    }

    const postData = {
        title,
        views: views ? parseInt(views) : 0,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        if (currentPostId) {
            // Cập nhật post
            await fetchApi(`/posts/${currentPostId}`, {
                method: 'PUT',
                body: JSON.stringify(postData)
            });
        } else {
            // Tạo post mới
            await fetchApi('/posts', {
                method: 'POST',
                body: JSON.stringify(postData)
            });
        }

        loadPosts();
        resetPostForm();
        updateStats();
        updatePostSelect();
        alert(currentPostId ? 'Cập nhật post thành công!' : 'Tạo post thành công!');
    } catch (error) {
        console.error('Lỗi khi lưu post:', error);
    }
}

async function softDeletePost(id) {
    if (confirm('Bạn có chắc muốn xóa post này?')) {
        try {
            await fetchApi(`/posts/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    isDeleted: true,
                    deletedAt: new Date().toISOString()
                })
            });
            loadPosts();
            updateStats();
            updatePostSelect();
            alert('Post đã được xóa mềm!');
        } catch (error) {
            console.error('Lỗi khi xóa post:', error);
        }
    }
}

async function restorePost(id) {
    try {
        await fetchApi(`/posts/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({
                isDeleted: false,
                deletedAt: null
            })
        });
        loadPosts();
        updateStats();
        updatePostSelect();
        alert('Post đã được khôi phục!');
    } catch (error) {
        console.error('Lỗi khi khôi phục post:', error);
    }
}

async function incrementViews(id) {
    try {
        const post = posts.find(p => p.id === id);
        if (post) {
            await fetchApi(`/posts/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    views: (post.views || 0) + 1,
                    updatedAt: new Date().toISOString()
                })
            });
            loadPosts();
            updateStats();
        }
    } catch (error) {
        console.error('Lỗi khi tăng views:', error);
    }
}

// Comment functions
async function loadComments() {
    comments = await fetchApi('/comments');
    if (!comments) return;
    
    updatePostSelect();
}

async function saveComment() {
    const postId = document.getElementById('commentPostId').value;
    const text = document.getElementById('commentText').value.trim();

    if (!postId || !text) {
        alert('Vui lòng điền đầy đủ thông tin!');
        return;
    }

    const commentData = {
        postId,
        text,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        if (currentCommentId) {
            // Cập nhật comment
            await fetchApi(`/comments/${currentCommentId}`, {
                method: 'PUT',
                body: JSON.stringify(commentData)
            });
        } else {
            // Tạo comment mới
            await fetchApi('/comments', {
                method: 'POST',
                body: JSON.stringify(commentData)
            });
        }

        loadComments();
        resetCommentForm();
        updateStats();
        alert(currentCommentId ? 'Cập nhật comment thành công!' : 'Gửi comment thành công!');
    } catch (error) {
        console.error('Lỗi khi lưu comment:', error);
    }
}

async function softDeleteComment(id) {
    if (confirm('Bạn có chắc muốn xóa comment này?')) {
        try {
            await fetchApi(`/comments/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    isDeleted: true,
                    deletedAt: new Date().toISOString()
                })
            });
            
            // Tải lại comments nếu section đang mở
            const postSection = document.querySelector(`.comments-section[style*="display: block"]`);
            if (postSection) {
                const postId = postSection.id.replace('comments-', '');
                viewComments(postId);
            }
            
            updateStats();
            alert('Comment đã được xóa mềm!');
        } catch (error) {
            console.error('Lỗi khi xóa comment:', error);
        }
    }
}

// Helper functions
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN');
}

function getCommentCount(postId) {
    return comments.filter(c => c.postId === postId && !c.isDeleted).length;
}

function updateStats() {
    const totalPosts = posts.length;
    const activePosts = posts.filter(p => !p.isDeleted).length;
    const deletedPosts = posts.filter(p => p.isDeleted).length;
    const totalComments = comments.filter(c => !c.isDeleted).length;
    const totalViews = posts.reduce((sum, post) => sum + (post.views || 0), 0);
    
    document.getElementById('totalPosts').textContent = totalPosts;
    document.getElementById('activePosts').textContent = activePosts;
    document.getElementById('deletedPosts').textContent = deletedPosts;
    document.getElementById('totalComments').textContent = totalComments;
    document.getElementById('totalViews').textContent = totalViews.toLocaleString('vi-VN');
}

// Hàm được gọi từ HTML
function toggleFilter(filterType) {
    currentFilter = filterType;
    
    // Cập nhật button styles
    document.querySelectorAll('.filter-controls button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById('filter' + filterType.charAt(0).toUpperCase() + filterType.slice(1)).classList.add('active');
    
    loadPosts();
}

function searchPosts() {
    loadPosts();
}

function sortPosts() {
    loadPosts();
}

function togglePostContent(id) {
    const contentDiv = document.getElementById(`content-${id}`);
    contentDiv.style.display = contentDiv.style.display === 'none' ? 'block' : 'none';
}

function editPost(id) {
    const post = posts.find(p => p.id === id);
    if (post) {
        document.getElementById('postId').value = post.id;
        document.getElementById('postTitle').value = post.title;
        document.getElementById('postViews').value = post.views || 0;
        currentPostId = post.id;
        document.getElementById('savePostBtn').textContent = '💾 Cập nhật Post';
        
        // Chuyển sang tab posts
        document.querySelector('.tab[data-tab="posts"]').click();
    }
}

function resetPostForm() {
    document.getElementById('postId').value = '';
    document.getElementById('postTitle').value = '';
    document.getElementById('postViews').value = '';
    currentPostId = '';
    document.getElementById('savePostBtn').textContent = '💾 Lưu Post';
}

function editComment(id) {
    const comment = comments.find(c => c.id === id);
    if (comment) {
        document.getElementById('commentPostId').value = comment.postId;
        document.getElementById('commentId').value = comment.id;
        document.getElementById('commentText').value = comment.text;
        currentCommentId = comment.id;
        document.getElementById('saveCommentBtn').textContent = '💾 Cập nhật Comment';
        
        // Chuyển sang tab comments
        document.querySelector('.tab[data-tab="comments"]').click();
    }
}

function resetCommentForm() {
    document.getElementById('commentPostId').value = '';
    document.getElementById('commentId').value = '';
    document.getElementById('commentText').value = '';
    currentCommentId = '';
    document.getElementById('saveCommentBtn').textContent = '💬 Gửi Comment';
}

function updatePostSelect() {
    const select = document.getElementById('commentPostId');
    select.innerHTML = '';
    
    const activePosts = posts.filter(p => !p.isDeleted).sort((a, b) => 
        a.title.localeCompare(b.title)
    );
    
    if (activePosts.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Chưa có post nào để comment';
        option.disabled = true;
        select.appendChild(option);
        return;
    }

    activePosts.forEach(post => {
        const option = document.createElement('option');
        option.value = post.id;
        option.textContent = `${post.title} (Views: ${post.views || 0})`;
        select.appendChild(option);
    });
}

function viewComments(postId) {
    const commentsSection = document.getElementById(`comments-${postId}`);
    if (!commentsSection) return;

    if (commentsSection.style.display === 'block') {
        commentsSection.style.display = 'none';
        return;
    }

    // Ẩn tất cả các section comment khác
    document.querySelectorAll('.comments-section').forEach(section => {
        section.style.display = 'none';
    });

    // Tải comments cho post này
    const postComments = comments.filter(c => c.postId === postId && !c.isDeleted);
    
    let html = '<h3 style="margin-bottom: 15px; color: #667eea;">💬 Comments:</h3>';
    
    if (postComments.length === 0) {
        html += '<p style="color: #999; padding: 10px;">Chưa có comment nào cho post này</p>';
    } else {
        postComments.forEach(comment => {
            html += `
                <div class="comment">
                    <div class="comment-content">${comment.text}</div>
                    <div class="comment-meta" style="color: #999; font-size: 0.85em; margin-top: 5px;">
                        ID: ${comment.id} | ${formatDate(comment.createdAt)}
                    </div>
                    <div class="comment-actions">
                        <button class="edit" onclick="editComment('${comment.id}')">✏️ Sửa</button>
                        <button class="delete" onclick="softDeleteComment('${comment.id}')">🗑️ Xóa</button>
                    </div>
                </div>
            `;
        });
    }

    // Thêm form comment
    html += `
        <div class="comment-form">
            <h4 style="margin-bottom: 15px; color: #667eea;">➕ Thêm Comment mới:</h4>
            <input type="hidden" id="quickCommentPostId" value="${postId}">
            <div class="form-group">
                <textarea id="quickCommentText" placeholder="Nội dung comment *" required></textarea>
            </div>
            <button onclick="saveQuickComment('${postId}')" style="width: 100%;">💬 Gửi Comment</button>
        </div>
    `;

    commentsSection.innerHTML = html;
    commentsSection.style.display = 'block';
}

function saveQuickComment(postId) {
    const text = document.getElementById('quickCommentText').value.trim();

    if (!text) {
        alert('Vui lòng nhập nội dung comment!');
        return;
    }

    const commentData = {
        postId,
        text,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    fetchApi('/comments', {
        method: 'POST',
        body: JSON.stringify(commentData)
    }).then(() => {
        viewComments(postId);
        updateStats();
        alert('Gửi comment thành công!');
    });
}