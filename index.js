// Direction-Manager 확장 - 방향 관리
import { getContext, renderExtensionTemplateAsync } from "../../../extensions.js";
import { SlashCommand } from "../../../slash-commands/SlashCommand.js";
import { SlashCommandParser } from "../../../slash-commands/SlashCommandParser.js";
import { ARGUMENT_TYPE, SlashCommandNamedArgument } from "../../../slash-commands/SlashCommandArgument.js";
import { POPUP_RESULT, POPUP_TYPE, Popup } from "../../../popup.js";

// 확장 설정
const extensionName = "Direction-Manager";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const defaultSettings = {
    enabled: true,
    directions: [],
    currentDirection: null
};

let settings = null;

// localStorage 설정 키
const STORAGE_KEY = 'direction-manager-settings';

// 설정 로드
function loadSettings() {
    try {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) {
            const parsed = JSON.parse(savedData);
            return { ...defaultSettings, ...parsed };
        } else {
            return { ...defaultSettings };
        }
    } catch (error) {
        console.error('[Direction Manager] 설정 로드 실패:', error);
        return { ...defaultSettings };
    }
}

// 설정 저장
function saveSettings() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
        console.error('[Direction Manager] 설정 저장 실패:', error);
    }
}

// 템플릿 렌더링
async function renderTemplate() {
    const template = await renderExtensionTemplateAsync(extensionFolderPath, 'template.html');
    return template;
}

// 이벤트 리스너 설정
function setupEventListeners(template) {
    // 라디오버튼 변경 이벤트
    template.find('.dm-compact--radio').off('change').on('change', function(event) {
        try {
            const direction = $(this).val();
            if (direction) {
                settings.currentDirection = direction;
                saveSettings();
                console.log('[Direction Manager] 방향 변경:', direction);
            }
        } catch (error) {
            console.error('[Direction Manager] 라디오버튼 이벤트 처리 오류:', error);
        }
    });
    
    // 텍스트에어리어 변경 이벤트
    template.find('.dm-compact--textarea').off('input').on('input', function(event) {
        try {
            const content = $(this).val();
            const direction = settings.currentDirection;
            if (direction) {
                if (!settings.directions) {
                    settings.directions = [];
                }
                const existingIndex = settings.directions.findIndex(d => d.direction === direction);
                if (existingIndex >= 0) {
                    settings.directions[existingIndex].content = content;
                } else {
                    settings.directions.push({ direction, content });
                }
                saveSettings();
            }
        } catch (error) {
            console.error('[Direction Manager] 텍스트에어리어 이벤트 처리 오류:', error);
        }
    });
}

// UI 업데이트
function updateUI(template) {
    // 현재 방향에 따른 라디오버튼 상태 설정
    if (settings.currentDirection) {
        template.find(`.dm-compact--radio[value="${settings.currentDirection}"]`).prop('checked', true);
    }
    
    // 현재 방향의 내용을 텍스트에어리어에 설정
    if (settings.currentDirection && settings.directions) {
        const currentDir = settings.directions.find(d => d.direction === settings.currentDirection);
        if (currentDir) {
            template.find('.dm-compact--textarea').val(currentDir.content);
        }
    }
}

// 확장 초기화
async function initialize() {
    try {
        settings = loadSettings();
        
        // 템플릿 렌더링
        const template = await renderTemplate();
        
        // UI 업데이트
        updateUI(template);
        
        // 이벤트 리스너 설정
        setupEventListeners(template);
        
        console.log('[Direction Manager] 초기화 완료');
    } catch (error) {
        console.error('[Direction Manager] 초기화 실패:', error);
    }
}

// 확장 시작
initialize();
