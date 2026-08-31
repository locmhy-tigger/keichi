# 功能待辦細節

## 網站全局基建服務
- 建立基於 Resend 的郵件發送服務層，供各模塊後續接入使用。
- 整合 Google Cloud 的 Google Calendar API，提供日曆服務層。

## 網站 Logo
- 移除英文字樣「ICHI」。

## 待辦事項
- 修復：待辦事項無法於列表中顯示的問題。

## 公告
- 隱藏入口。

## 活動管理
- 隱藏入口。

## 任務管理
- 隱藏入口。

## 績點
- 隱藏入口。

## 行事曆
- 新增：將活動同步至用戶外部 Google Calendar。

## 行政
- 新增：將「活動文件」嵌入式網站轉換為站內預設工具「活動文件」。
- 新增：將「Quotation」嵌入式網站轉換為站內預設工具「KCquotation 報價」。
- 構建：「KCquotation」預設工具之實際功能頁（已完成）——路由 `/teacher/committee/admin/quotation`，伺服器端 docxtemplater 生成官方採購報價表 DOCX + Claude OCR 預填，無狀態、不存 DB。模板 `public/templates/quotation.docx`，產生器 `scripts/make-quotation-template.py`。
- 構建：「活動文件」預設工具之實際功能頁（目前僅為「即將推出」入口，`PresetToolsGrid` 對無 `href` 工具顯示 `cursor-not-allowed`，尚無 `page.tsx`）。

## 訓育
- 新增：「行為記錄」新增記錄時，判斷是否符合「訓育設定」的發送電郵觸發條件。
- 補充：班主任電郵將於「群組管理 - 班級分組」中進行綁定。

## 資訊科技
- 移除：「Quotation」及「KCquotation 報價」入口

## 群組管理
- 更新：將「學生分組」更名為「班級分組」；「班級分組 - 成員管理」視窗應允許綁定教職員。
- 修復：班級分組標籤頁在管理員身份下無法正確渲染班級列表。