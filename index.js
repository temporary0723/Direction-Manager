// Direction-Manager 확장 - SillyTavern Extension
// 방향성 관리 기능을 제공하는 확장

import {
    eventSource,
    event_types,
    chat,
    getRequestHeaders,
    saveSettingsDebounced,
    substituteParams,
} from '../../../../script.js';

import {
    getContext,
    extension_settings,
    saveMetadataDebounced,
} from '../../../extensions.js';

import {
    POPUP_TYPE,
    callGenericPopup,
    POPUP_RESULT,
} from '../../../popup.js';

import {
    uuidv4,
    timestampToMoment,
} from '../../../utils.js';

// 확장 이름 및 상수 정의
const pluginName = 'direction-manager';
const extensionFolderPath = `scripts/extensions/third-party/Direction-Manager`;

// 방향성 데이터 저장을 위한 메타데이터 키
const DIRECTION_METADATA_KEY = 'direction_data_v1';

// 방향성 데이터 저장소
let directionData = {
    currentDirection: null,
    directionHistory: [],
    settings: {
        autoSave: true,
        maxHistory: 50
    }
};

// 현재 열린 모달
let currentModal = null;

// Extension Settings에 방향성 인덱스 초기화
function initializeDirectionIndex() {
    if (!extension_settings[pluginName]) {
        extension_settings[pluginName] = {
            directionIndex: {},
            version: '1.0'
        };
        saveSettingsDebounced();
    }
    
    // 기존 설정에 directionIndex가 없으면 추가
    if (!extension_settings[pluginName].directionIndex) {
        extension_settings[pluginName].directionIndex = {};
        saveSettingsDebounced();
    }
}

// 방향성 데이터 로드
function loadDirectionData() {
    try {
        const context = getContext();
        if (!context || !context.chatMetadata) {
            directionData = {
                currentDirection: null,
                directionHistory: [],
                settings: {
                    autoSave: true,
                    maxHistory: 50
                }
            };
            return;
        }

        const savedDirectionData = context.chatMetadata[DIRECTION_METADATA_KEY];
        
        if (savedDirectionData && typeof savedDirectionData === 'object') {
            directionData = {
                currentDirection: savedDirectionData.currentDirection || null,
                directionHistory: savedDirectionData.directionHistory || [],
                settings: {
                    autoSave: savedDirectionData.settings?.autoSave ?? true,
                    maxHistory: savedDirectionData.settings?.maxHistory ?? 50
                }
            };
        } else {
            directionData = {
                currentDirection: null,
                directionHistory: [],
                settings: {
                    autoSave: true,
                    maxHistory: 50
                }
            };
        }
    } catch (error) {
        console.error('방향성 데이터 로드 실패:', error);
        directionData = {
            currentDirection: null,
            directionHistory: [],
            settings: {
                autoSave: true,
                maxHistory: 50
            }
        };
    }
}

// 방향성 데이터 저장
function saveDirectionData() {
    try {
        const context = getContext();
        if (!context || !context.chatMetadata) {
            console.error('[Direction-Manager] 컨텍스트 또는 메타데이터를 찾을 수 없어 방향성 데이터를 저장할 수 없습니다.');
            return;
        }

        // 메타데이터에 방향성 데이터 저장
        context.chatMetadata[DIRECTION_METADATA_KEY] = { ...directionData };
        
        // 메타데이터 변경사항 저장
        saveMetadataDebounced();
        
    } catch (error) {
        console.error('방향성 데이터 저장 실패:', error);
    }
}

// 방향성 설정
function setDirection(direction) {
    if (!direction || typeof direction !== 'string') {
        console.error('[Direction-Manager] 유효하지 않은 방향성입니다.');
        return;
    }

    // 이전 방향성을 히스토리에 추가
    if (directionData.currentDirection) {
        directionData.directionHistory.unshift({
            id: uuidv4(),
            direction: directionData.currentDirection,
            timestamp: new Date().toISOString()
        });

        // 히스토리 크기 제한
        if (directionData.directionHistory.length > directionData.settings.maxHistory) {
            directionData.directionHistory = directionData.directionHistory.slice(0, directionData.settings.maxHistory);
        }
    }

    // 새로운 방향성 설정
    directionData.currentDirection = direction;

    // 자동 저장이 활성화되어 있으면 저장
    if (directionData.settings.autoSave) {
        saveDirectionData();
    }

    // UI 업데이트
    updateDirectionUI();
}

// 방향성 초기화
function clearDirection() {
    directionData.currentDirection = null;
    
    if (directionData.settings.autoSave) {
        saveDirectionData();
    }
    
    updateDirectionUI();
}

// 방향성 히스토리에서 복원
function restoreFromHistory(historyId) {
    const historyItem = directionData.directionHistory.find(item => item.id === historyId);
    if (historyItem) {
        setDirection(historyItem.direction);
    }
}

// 방향성 히스토리 삭제
function deleteFromHistory(historyId) {
    const index = directionData.directionHistory.findIndex(item => item.id === historyId);
    if (index !== -1) {
        directionData.directionHistory.splice(index, 1);
        
        if (directionData.settings.autoSave) {
            saveDirectionData();
        }
        
        updateDirectionUI();
    }
}

// 방향성 UI 업데이트
function updateDirectionUI() {
    // 컴팩트 UI 업데이트
    const compactButton = $('.dm-compact--button');
    if (compactButton.length > 0) {
        if (directionData.currentDirection) {
            compactButton.addClass('dm-compact--hasPopup');
        } else {
            compactButton.removeClass('dm-compact--hasPopup');
        }
    }
}

// 방향성 설정 모달 생성
async function createDirectionModal() {
    const modalHtml = `
        <div class="dm-compact--popup dm-compact--active">
            <div class="dm-compact--header">
                <div class="dm-compact--title-row">
                    <div class="dm-compact--title">방향성 관리</div>
                </div>
            </div>
            <div class="dm-compact--content">
                <div class="direction-input-section">
                    <label for="direction-input">현재 방향성:</label>
                    <textarea id="direction-input" class="dm-compact--textarea" placeholder="채팅의 방향성을 입력하세요...">${directionData.currentDirection || ''}</textarea>
                </div>
                <div class="direction-history-section">
                    <h4>방향성 히스토리</h4>
                    <div id="direction-history-list" class="direction-history-list">
                        ${directionData.directionHistory.map(item => `
                            <div class="direction-history-item" data-id="${item.id}">
                                <div class="direction-text">${item.direction}</div>
                                <div class="direction-timestamp">${new Date(item.timestamp).toLocaleString()}</div>
                                <div class="direction-actions">
                                    <button class="restore-btn" title="복원">복원</button>
                                    <button class="delete-btn" title="삭제">삭제</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="direction-actions-section">
                    <button id="save-direction-btn" class="save-btn">저장</button>
                    <button id="clear-direction-btn" class="clear-btn">초기화</button>
                </div>
            </div>
        </div>
    `;

    // 기존 모달 제거
    if (currentModal) {
        currentModal.remove();
    }

    currentModal = $(modalHtml);
    $('body').append(currentModal);

    // 이벤트 핸들러 설정
    setupDirectionModalEvents();
}

// 방향성 모달 이벤트 설정
function setupDirectionModalEvents() {
    if (!currentModal) return;

    // 저장 버튼
    currentModal.find('#save-direction-btn').on('click', function() {
        const direction = currentModal.find('#direction-input').val().trim();
        if (direction) {
            setDirection(direction);
            toastr.success('방향성이 저장되었습니다.');
        } else {
            toastr.warning('방향성을 입력해주세요.');
        }
    });

    // 초기화 버튼
    currentModal.find('#clear-direction-btn').on('click', function() {
        if (confirm('방향성을 초기화하시겠습니까?')) {
            clearDirection();
            currentModal.find('#direction-input').val('');
            toastr.info('방향성이 초기화되었습니다.');
        }
    });

    // 히스토리 복원 버튼
    currentModal.find('.restore-btn').on('click', function() {
        const historyId = $(this).closest('.direction-history-item').data('id');
        restoreFromHistory(historyId);
        currentModal.find('#direction-input').val(directionData.currentDirection || '');
        toastr.success('방향성이 복원되었습니다.');
    });

    // 히스토리 삭제 버튼
    currentModal.find('.delete-btn').on('click', function() {
        const historyId = $(this).closest('.direction-history-item').data('id');
        if (confirm('이 방향성을 히스토리에서 삭제하시겠습니까?')) {
            deleteFromHistory(historyId);
            createDirectionModal(); // 모달 새로고침
            toastr.info('방향성이 히스토리에서 삭제되었습니다.');
        }
    });

    // 모달 외부 클릭 시 닫기
    $(document).on('click', function(e) {
        if (currentModal && !currentModal.is(e.target) && currentModal.has(e.target).length === 0) {
            currentModal.remove();
            currentModal = null;
        }
    });
}

// 컴팩트 UI 버튼 추가
function addCompactButton() {
    // 기존 버튼이 있으면 제거
    $('.dm-compact--button').remove();

    const buttonHtml = `
        <div class="dm-compact--button" title="방향성 관리">
            <i class="fa-solid fa-compass"></i>
        </div>
    `;

    // 컴팩트 UI 영역에 버튼 추가
    const compactUI = $('.compact_ui');
    if (compactUI.length > 0) {
        compactUI.append(buttonHtml);
    } else {
        // 컴팩트 UI가 없으면 다른 위치에 추가
        $('body').append(buttonHtml);
    }

    // 버튼 클릭 이벤트
    $('.dm-compact--button').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        createDirectionModal();
    });
}

// 채팅 변경 처리
function handleChatChanged() {
    // 새로운 채팅의 방향성 데이터를 로드
    loadDirectionData();
    
    // UI 업데이트
    updateDirectionUI();
}

// 확장 초기화
function initializeDirectionManager() {
    // Extension Settings 초기화
    initializeDirectionIndex();
    
    // 방향성 데이터 로드
    loadDirectionData();
    
    // 컴팩트 UI 버튼 추가
    addCompactButton();
    
    // 이벤트 리스너 설정
    eventSource.on(event_types.CHAT_CHANGED, handleChatChanged);
    
    // UI 업데이트
    updateDirectionUI();
}

// jQuery 준비 완료 시 초기화
jQuery(() => {
    initializeDirectionManager();
});
