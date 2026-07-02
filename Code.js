/**
 * スプレッドシート起動時の処理。
 * カスタムメニューを追加します。
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("セット会計")
    .addItem("セット会計サポートを起動 (大画面ダイアログ)", "showDialog")
    .addItem("マスタシートを初期設定する", "setupMasterSheet")
    .addToUi();

  // 起動時に自動で大画面ダイアログをポップアップ表示
  showDialog();
}

/**
 * 大画面のモードレスダイアログとしてUI（index.html）を表示します。
 */
function showDialog() {
  var html = HtmlService.createHtmlOutputFromFile("index")
    .setTitle("セット会計サポート")
    .setWidth(680)
    .setHeight(850);
  SpreadsheetApp.getUi().showModelessDialog(html, "セット会計サポート");
}

// 日本語名からアルファベットのシステムIDに変換するための自動マッピングキャッシュ
var autoIdMap = {};
var autoIdCounter = 1;

/**
 * 日本語の商品名から、システム内部で利用するアルファベットIDを取得します。
 * 新しい商品が手動追加された場合も自動で一意のID（item_1, item_2...）を生成します。
 * @param {string} name 日本語の商品名
 * @return {string} アルファベットの商品ID
 */
function getSystemId(name) {
  name = String(name || "").trim();
  if (name === "") return "";

  // 標準商品のマッピング定義
  var stdMap = {
    シナール: "shinal",
    ハイチオール: "haichi",
    ハイシー顆粒: "haishi",
    ハイシー: "haishi",
    "トラネ500mg「YD」": "trane500",
    トラネ500: "trane500",
    "トラネ250mg「YD」": "trane250",
    トラネ250: "trane250",
    トランサミン250mg: "transa250",
    トランサミン250: "transa250",
    トランサミン500mg: "transa500",
    トランサミン500: "transa500",
    トコフェロール200mg: "tocoNico",
    トコフェロール: "tocoNico",
    ユベラ50mg: "yubera50",
    ユベラ50: "yubera50",
    ユベラN100mg: "yuberaN100",
    ユベラN100: "yuberaN100",
    ユベラN200mg: "yuberaN200",
    ユベラN200: "yuberaN200",
    ノイロビタン配合錠: "noivitan",
    ノイロビタン: "noivitan",
  };

  if (stdMap[name]) return stdMap[name];

  // 辞書にない新規の日本語名の場合は、自動でIDを割り当てて記憶する
  if (autoIdMap[name]) return autoIdMap[name];

  var newId = "item_" + autoIdCounter;
  autoIdCounter++;
  autoIdMap[name] = newId;
  return newId;
}

/**
 * 縦並びの「マスタ」シートからデータを動的にロードし、フロントエンド用のJSONオブジェクトに変換して返します。
 * 見出し文字列（「単品価格」「2種セット」等）を検知してセクションを判定します。
 * @return {Object} マスタデータ
 */
function getMasterData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("マスタ");
  if (!sheet) {
    console.warn("「マスタ」シートが見つかりません");
    return { products: [], sets2: [], sets3: [], add: {} };
  }

  var data = sheet.getDataRange().getValues();

  var products = [];
  var sets2 = [];
  var sets3 = [];
  var add = {};

  var currentSection = ""; // 'products', 'sets2', 'sets3', 'add'

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var valA = String(row[0] || "").trim();

    if (valA === "") continue;

    // セクション見出しの判定（行番号に依存せず、文字部分一致で判別）
    if (valA.indexOf("単品価格") !== -1) {
      currentSection = "products";
      continue;
    }
    if (valA.indexOf("2種セット") !== -1) {
      currentSection = "sets2";
      continue;
    }
    if (valA.indexOf("3種セット") !== -1) {
      currentSection = "sets3";
      continue;
    }
    if (valA.indexOf("追加価格") !== -1) {
      currentSection = "add";
      continue;
    }

    // データ行の読み取り
    if (currentSection === "products") {
      var sysId = getSystemId(valA);
      products.push({
        id: sysId,
        name: valA,
        single: Number(row[1]) || 0,
        group: "", // カテゴリ列は廃止
      });
    } else if (currentSection === "sets2") {
      var valB = String(row[1] || "").trim();
      if (valB !== "") {
        var idA = getSystemId(valA);
        var idB = getSystemId(valB);
        sets2.push([idA, idB, Number(row[2]) || 0]);
      }
    } else if (currentSection === "sets3") {
      var valB = String(row[1] || "").trim();
      var valC = String(row[2] || "").trim();
      if (valB !== "" && valC !== "") {
        var idA = getSystemId(valA);
        var idB = getSystemId(valB);
        var idC = getSystemId(valC);
        sets3.push([idA, idB, idC, Number(row[3]) || 0]);
      }
    } else if (currentSection === "add") {
      var sysId = getSystemId(valA);
      add[sysId] = Number(row[1]) || 0;
    }
  }

  return {
    products: products,
    sets2: sets2,
    sets3: sets3,
    add: add,
  };
}

/**
 * デフォルトデータに基づいて「マスタ」シートを「縦並び（日本語ID廃止）」で自動生成し、初期設定を行います。
 */
function setupMasterSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("マスタ");
  var ui = SpreadsheetApp.getUi();

  if (sheet) {
    var response = ui.alert(
      "マスタシートの上書き確認",
      "すでに「マスタ」シートが存在します。既存のデータをすべて消去して初期値でリセットしてもよろしいですか？",
      ui.ButtonSet.YES_NO
    );
    if (response !== ui.Button.YES) {
      return;
    }
  } else {
    sheet = ss.insertSheet("マスタ");
  }

  sheet.clear();

  // 初期データ (IDやグループは無く、日本語名と数値のみ)
  var defaultProducts = [
    ["シナール", 1900],
    ["ハイチオール", 2100],
    ["ハイシー顆粒", 1900],
    ["トラネ500mg「YD」", 3900],
    ["トラネ250mg「YD」", 2500],
    ["トランサミン250mg", 2700],
    ["トランサミン500mg", 4700],
    ["トコフェロール200mg", 2200],
    ["ユベラ50mg", 2000],
    ["ユベラN100mg", 2200],
    ["ユベラN200mg", 2700],
    ["ノイロビタン配合錠", 2200],
  ];

  var defaultSets2 = [
    ["シナール", "トコフェロール200mg", 3600],
    ["シナール", "トラネ500mg「YD」", 4800],
    ["シナール", "トラネ250mg「YD」", 4000],
    ["シナール", "トランサミン250mg", 4500],
    ["シナール", "トランサミン500mg", 6000],
    ["シナール", "ハイチオール", 3300],
    ["シナール", "ユベラ50mg", 3600],
    ["シナール", "ユベラN100mg", 3600],
    ["シナール", "ユベラN200mg", 3900],
    ["ハイチオール", "トランサミン250mg", 4000],
    ["ハイチオール", "ハイシー顆粒", 3000],
    ["ハイチオール", "ユベラN200mg", 4300],
    ["ハイチオール", "トラネ500mg「YD」", 4800],
    ["ハイチオール", "トコフェロール200mg", 3700],
    ["トラネ500mg「YD」", "トコフェロール200mg", 5200],
    ["トラネ500mg「YD」", "ユベラN200mg", 6000],
  ];

  var defaultSets3 = [
    ["シナール", "トラネ500mg「YD」", "トコフェロール200mg", 5900],
    ["シナール", "トラネ500mg「YD」", "ハイチオール", 5900],
    ["シナール", "トラネ500mg「YD」", "ユベラ50mg", 5900],
    ["シナール", "トラネ500mg「YD」", "ユベラN100mg", 6200],
    ["シナール", "トラネ500mg「YD」", "ユベラN200mg", 6400],
    ["シナール", "トランサミン500mg", "ユベラN200mg", 7300],
    ["シナール", "ハイチオール", "ユベラ50mg", 4700],
    ["シナール", "ハイチオール", "ユベラN100mg", 4700],
    ["シナール", "ハイチオール", "ユベラN200mg", 5000],
    ["シナール", "ハイチオール", "トコフェロール200mg", 4600],
  ];

  var defaultAdd = [
    ["ハイチオール", 1500],
    ["トコフェロール200mg", 1500],
    ["ノイロビタン配合錠", 2000],
  ];

  var r = 1; // 行ポインタ

  // 1. 単品価格 (A〜B列)
  sheet.getRange(r, 1, 1, 2).setValues([["商品名", "単品価格"]]);
  styleSectionHeader(sheet.getRange(r, 1, 1, 4), "#D4E6F1"); // 薄青
  r++;
  sheet.getRange(r, 1, defaultProducts.length, 2).setValues(defaultProducts);
  r += defaultProducts.length;

  // 空行
  r++;

  // 2. 2種セット (A〜C列)
  sheet.getRange(r, 1, 1, 3).setValues([["薬A", "薬B", "セット価格"]]);
  styleSectionHeader(sheet.getRange(r, 1, 1, 4), "#FCF3CF"); // 薄黄
  r++;
  sheet.getRange(r, 1, defaultSets2.length, 3).setValues(defaultSets2);
  r += defaultSets2.length;

  r++;

  // 3. 3種セット (A〜D列)
  sheet.getRange(r, 1, 1, 4).setValues([["薬A", "薬B", "薬C", "セット価格"]]);
  styleSectionHeader(sheet.getRange(r, 1, 1, 4), "#D5F5E3"); // 薄緑
  r++;
  sheet.getRange(r, 1, defaultSets3.length, 4).setValues(defaultSets3);
  r += defaultSets3.length;

  r++;

  // 4. 追加価格 (A〜B列)
  sheet.getRange(r, 1, 1, 2).setValues([["商品名", "追加価格"]]);
  styleSectionHeader(sheet.getRange(r, 1, 1, 4), "#EDBB99"); // 薄オレンジ
  r++;
  sheet.getRange(r, 1, defaultAdd.length, 2).setValues(defaultAdd);
  r += defaultAdd.length;

  // デザイン装飾（格子線と幅自動調整）
  sheet
    .getRange(1, 1, r - 1, 4)
    .setBorder(true, true, true, true, true, true, "#D0D3D4", SpreadsheetApp.BorderStyle.SOLID);
  for (var col = 1; col <= 4; col++) {
    sheet.autoResizeColumn(col);
  }

  ui.alert(
    "初期設定完了",
    "「マスタ」シートを縦並び（日本語ID廃止版）で自動生成しました！",
    ui.ButtonSet.OK
  );
}

/**
 * 各見出し行のスタイルを装飾（セル結合・太字・背景色）します。
 */
function styleSectionHeader(range, bgColor) {
  range.setFontWeight("bold");
  range.setBackground(bgColor);
  range.merge();
  range.setHorizontalAlignment("left");
}
