const UPLOAD_URL = window.location.origin;
let serverConfig = null;

// 格式化字节数为可读字符串
function formatBytes(bytes) {
    if (bytes === 0) return '0B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + sizes[i];
}

// 获取服务器配置
async function fetchServerConfig() {
    try {
        const response = await fetch(`${UPLOAD_URL}/api/config`);
        if (response.ok) {
            serverConfig = await response.json();
            updateMaxExpirationDisplay();
            updateMaxFileSizeDisplay();
        }
    } catch (error) {
        console.error('获取服务器配置失败:', error);
    }
}

// 更新最大有效期显示
function updateMaxExpirationDisplay() {
    if (!serverConfig || !serverConfig.maxAgeForMultiDownload) return;
    
    const maxExpirationSeconds = serverConfig.maxAgeForMultiDownload;
    let value = maxExpirationSeconds;
    let unit = '秒';
    
    if (maxExpirationSeconds % 86400 === 0) {
        value = maxExpirationSeconds / 86400;
        unit = '天';
    } else if (maxExpirationSeconds % 3600 === 0) {
        value = maxExpirationSeconds / 3600;
        unit = '小时';
    } else if (maxExpirationSeconds % 60 === 0) {
        value = maxExpirationSeconds / 60;
        unit = '分钟';
    }
    
    const maxExpirationInfo = document.getElementById('maxExpirationInfo');
    if (maxExpirationInfo) {
        maxExpirationInfo.textContent = `💡 最大允许值: ${value}${unit}`;
    }
}

// 更新最大文件大小显示
function updateMaxFileSizeDisplay() {
    if (!serverConfig || !serverConfig.maxUploadSize) return;
    
    const maxSizeBytes = serverConfig.maxUploadSize;
    const maxSizeText = formatBytes(maxSizeBytes);
    
    const maxFileSizeInfo = document.getElementById('maxFileSizeInfo');
    if (maxFileSizeInfo) {
        maxFileSizeInfo.textContent = `最大: ${maxSizeText}`;
    }
}


// DOM加载完成后的初始化操作
document.addEventListener('DOMContentLoaded', function() {
    fetchServerConfig();
    
    const usePasswordCheckbox = document.getElementById('usePassword');
    const passwordContainer = document.getElementById('passwordContainer');
    usePasswordCheckbox.addEventListener('change', function() {
        passwordContainer.style.display = this.checked ? 'flex' : 'none';
    });

    const useExpirationCheckbox = document.getElementById('useExpiration');
    const expirationContainer = document.getElementById('expirationContainer');
    useExpirationCheckbox.addEventListener('change', function() {
        expirationContainer.style.display = this.checked ? 'flex' : 'none';
    });

    const setExpirationBtn = document.getElementById('setExpirationBtn');
    const expirationResult = document.getElementById('expirationResult');
    setExpirationBtn.addEventListener('click', function() {
        expirationResult.style.display = 'block';
        setTimeout(() => {
            expirationResult.style.display = 'none';
        }, 2000);
    });
});

// 获取DOM元素
const uploadContainer = document.getElementById('uploadContainer');
const uploadStatus = document.getElementById('uploadStatus');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const fileList = document.getElementById('fileList');

// 拖放事件处理
uploadContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadContainer.classList.add('dragging');
});
uploadContainer.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadContainer.classList.remove('dragging');
});
uploadContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadContainer.classList.remove('dragging');
    if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
    }
});

function handleFileSelect(e) {
    if (e.target.files.length > 0) {
        handleFiles(e.target.files);
    }
}

function handleFiles(files) {
    for (let i = 0; i < files.length; i++) {
        uploadFile(files[i]);
    }
}

function showStatus(message, type) {
    uploadStatus.textContent = message;
    uploadStatus.className = 'upload-status ' + type;
    uploadStatus.style.display = 'block';
}

function showProgress() {
    progressBar.style.display = 'block';
    progressFill.style.width = '0%';
}

function updateProgress(percent) {
    progressFill.style.width = percent + '%';
}

function hideProgress() {
    progressBar.style.display = 'none';
}

// 上传文件主函数
async function uploadFile(file) {
    const maxFileSize = serverConfig?.maxUploadSize || (5 * 1024 * 1024 * 1024); // 默认5GB
    if (file.size > maxFileSize) {
        showStatus(`文件 ${file.name} 超过 ${formatBytes(maxFileSize)} 大小限制。`, 'error');
        return;
    }
    
    const usePassword = document.getElementById('usePassword').checked;
    const passwordInput = document.getElementById('passwordInput');
    if (usePassword && !passwordInput.value.trim()) {
        showStatus('请输入密码以启用密码保护。', 'error');
        return;
    }
    
    await uploadSimpleFile(file);
}

function addFileToList(fileName, url) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';

    const useExpiration = document.getElementById('useExpiration').checked;
    const usePassword = document.getElementById('usePassword').checked;

    let headersHTML = '';

    if (useExpiration) {
        const expirationInput = document.getElementById('expirationInput').value;
        const expirationUnitSelect = document.getElementById('expirationUnit');
        const unitText = expirationUnitSelect.options[expirationUnitSelect.selectedIndex].text;
        headersHTML += `<span class="file-item-header expiring">🕐 有效期: ${expirationInput}${unitText}</span>`;
    } else {
        headersHTML += `<span class="file-item-header one-time">⚠️ 一次性链接</span>`;
    }

    if (usePassword) {
        headersHTML += `<span class="file-item-header password">🔒 密码保护</span>`;
    }

    fileItem.innerHTML = `
        ${headersHTML}
        <div class="file-url-container">
            <span class="file-url">
                <strong>${fileName}:</strong> <a href="${url}" target="_blank">${url}</a>
            </span>
            <button class="copy-button">复制链接</button>
        </div>
    `;

    fileList.prepend(fileItem);

    const copyButton = fileItem.querySelector('.copy-button');
    copyButton.onclick = function() {
        copyToClipboard(url);
        copyButton.textContent = '已复制！';
        setTimeout(() => {
            copyButton.textContent = '复制链接';
        }, 2000);
    };
}


async function uploadSimpleFile(file, maxRetries = 3) {
    showStatus(`正在上传 ${file.name}...`, 'uploading');
    showProgress();
    
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await uploadWithProgress(file, (progress) => {
                updateProgress(progress);
            });
            
            if (response.status === 200) {
                const responseUrl = response.responseText.trim();
                if (responseUrl.startsWith('http')) {
                    hideProgress();
                    showStatus(`成功上传 ${file.name}！`, 'success');
                    const cleanUrl = responseUrl.split('\n')[0];
                    addFileToList(file.name, cleanUrl);
                    return;
                } else {
                    throw new Error('上传完成但收到意外响应');
                }
            } else if (response.status === 401) {
                hideProgress();
                showStatus('密码错误，请检查密码是否与服务器配置相同。', 'error');
                return;
            } else {
                throw new Error(`服务器返回状态 ${response.status}`);
            }
        } catch (error) {
            lastError = error;
            console.error(`上传失败 (尝试 ${attempt}/${maxRetries}):`, error);
            
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt - 1) * 1000;
                showStatus(`上传失败，${delay/1000} 秒后重试...`, 'uploading');
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    hideProgress();
    showStatus(`上传 ${file.name} 失败: ${lastError.message}`, 'error');
}

function uploadWithProgress(file, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', e => {
            if (e.lengthComputable) {
                onProgress((e.loaded / e.total) * 100);
            }
        });

        xhr.addEventListener('load', () => {
            resolve({
                status: xhr.status,
                responseText: xhr.responseText
            });
        });

        xhr.addEventListener('error', () => reject(new Error('网络错误')));
        
        // 我们直接上传到根路径，由Worker处理文件名
        xhr.open('PUT', `${UPLOAD_URL}/${file.name}`);
        
        if (document.getElementById('usePassword').checked) {
            xhr.setRequestHeader('Authorization', document.getElementById('passwordInput').value);
        }
        
        if (document.getElementById('useExpiration').checked) {
            const value = parseInt(document.getElementById('expirationInput').value, 10);
            const unit = document.getElementById('expirationUnit').value;
            let seconds = 3600; // Default 1 hour
            if(value > 0) {
                switch(unit) {
                    case 'seconds': seconds = value; break;
                    case 'minutes': seconds = value * 60; break;
                    case 'hours':   seconds = value * 3600; break;
                    case 'days':    seconds = value * 86400; break;
                }
            }
            xhr.setRequestHeader('X-Expiration-Seconds', seconds);
        }
        
        xhr.send(file);
    });
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(err => {
        console.error('无法复制到剪贴板:', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
        } catch (err) {
            console.error('Fallback copy failed:', err);
        }
        document.body.removeChild(textArea);
    });
}