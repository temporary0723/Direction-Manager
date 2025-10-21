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
    uuidv4,
    timestampToMoment,
} from '../../../utils.js';

// 확장 이름 및 상수 정의
const extensionName = 'Direction-Manager';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// 방향성 데이터 저장을 위한 메타데이터 키
const DIRECTION_METADATA_KEY = 'direction_data_v1';

// 기본 설정
const defaultSettings = {
    currentDirection: null,
    directionHistory: [],
    settings: {
        autoSave: true,
        maxHistory: 50
    },
    compactUI: true  // 컴팩트 UI 활성화
};

// 방향성 데이터 저장소
let directionData = { ...defaultSettings };

// 컴팩트 UI 관련 변수들
let compactUIButton = null;
let compactUIPopup = null;

// 설정 로드
async function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }
    
    // 기존 데이터를 현재 설정으로 로드
    directionData = { ...defaultSettings, ...extension_settings[extensionName] };
}

// 방향성 데이터 저장
function saveDirectionData() {
    try {
        // extension_settings에 저장
        extension_settings[extensionName] = { ...directionData };
        saveSettingsDebounced();
        
        // 채팅 메타데이터에도 저장
        const context = getContext();
        if (context && context.chatMetadata) {
            context.chatMetadata[DIRECTION_METADATA_KEY] = { ...directionData };
            saveMetadataDebounced();
        }
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
    updateCompactUIButton();
}

// 방향성 초기화
function clearDirection() {
    directionData.currentDirection = null;
    
    if (directionData.settings.autoSave) {
        saveDirectionData();
    }
    
    updateCompactUIButton();
}

// 컴팩트 UI 팝업 닫기
function closeCompactUIPopup() {
    if (compactUIPopup) {
        compactUIPopup.remove();
        compactUIPopup = null;
    }
    
    if (compactUIButton) {
        compactUIButton.removeClass('dm-compact--hasPopup');
    }
}

// 컴팩트 UI 팝업 표시
function showCompactUIPopup() {
    if (compactUIPopup) {
        return closeCompactUIPopup();
    }
    
    compactUIButton.addClass('dm-compact--hasPopup');
    
    const popupHtml = `
        <div class="dm-compact--popup">
            <div class="dm-compact--header">
                <div class="dm-compact--title-row">
                    <div class="dm-compact--title">방향성 관리</div>
                </div>
                <button class="dm-compact--nav dm-compact--clear" title="방향성 초기화">
                    <i class="fa-solid fa-eraser"></i>
                </button>
            </div>
            <div class="dm-compact--content">
                <textarea class="dm-compact--textarea" 
                          placeholder="채팅의 방향성을 입력하세요..." 
                          id="direction-input">${directionData.currentDirection || ''}</textarea>
            </div>
        </div>
    `;
    
    compactUIPopup = $(popupHtml);
    $('#nonQRFormItems').append(compactUIPopup);
    
    // 애니메이션
    setTimeout(() => {
        compactUIPopup.addClass('dm-compact--active');
    }, 10);
    
    // 이벤트 핸들러 설정
    setupCompactUIEventListeners();
}

// 컴팩트 UI 이벤트 리스너 설정
function setupCompactUIEventListeners() {
    if (!compactUIPopup) return;
    
    // 지우개 버튼
    compactUIPopup.find('.dm-compact--clear').on('click', function() {
        const confirmed = confirm('방향성을 초기화하시겠습니까?');
        if (confirmed) {
            clearDirection();
            compactUIPopup.find('#direction-input').val('');
        }
    });
    
    // 텍스트에어리어 변경 이벤트
    compactUIPopup.find('#direction-input').on('input', function() {
        const newDirection = $(this).val().trim();
        if (newDirection) {
            setDirection(newDirection);
        }
    });
    
    // 외부 클릭시 닫기
    $(document).on('click.compactUI', (e) => {
        if (!$(e.target).closest('.dm-compact--popup, .dm-compact--button').length) {
            closeCompactUIPopup();
            $(document).off('click.compactUI');
        }
    });
}

// 컴팩트 UI 버튼 추가/제거
function updateCompactUIButton() {
    const ta = document.querySelector('#send_textarea');
    if (!ta) {
        setTimeout(updateCompactUIButton, 1000);
        return;
    }
    
    // 기존 버튼 제거
    if (compactUIButton) {
        compactUIButton.remove();
        compactUIButton = null;
    }
    
    // 컴팩트 UI가 활성화된 경우만 버튼 추가
    if (directionData.compactUI) {
        const buttonHtml = `
            <div class="dm-compact--button menu_button" title="방향성 관리">
                <i class="fa-solid fa-compass"></i>
            </div>
        `;
        
        compactUIButton = $(buttonHtml);
        $(ta).after(compactUIButton);
        
        // 클릭 이벤트
        compactUIButton.on('click', showCompactUIPopup);
    }
}

// 채팅 변경 처리
function handleChatChanged() {
    // 새로운 채팅의 방향성 데이터를 로드
    loadSettings();
    
    // UI 업데이트
    updateCompactUIButton();
}

// 확장 초기화
async function initializeDirectionManager() {
    // 설정 로드
    await loadSettings();
    
    // 컴팩트 UI 버튼 추가
    updateCompactUIButton();
    
    // 이벤트 리스너 설정
    eventSource.on(event_types.CHAT_CHANGED, handleChatChanged);
}

// jQuery 준비 완료 시 초기화
jQuery(() => {
    initializeDirectionManager();
});
