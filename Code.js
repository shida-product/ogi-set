/**
 * スプレッドシート起動時の処理。
 * カスタムメニューを追加します。
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("セット会計")
    .addItem("セット会計サポートを起動", "showSidebar")
    .addItem("マスタシートを初期設定する", "setupMasterSheet")
    .addToUi();
}

/**
 * サイドバーにUI（index.html）を表示します。
 */
function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile("index")
    .setTitle("セット会計サポート")
    .setWidth(400);
  SpreadsheetApp.getUi().showSidebar(html);
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
      products.push({
        id: valA,
        name: String(row[1] || "").trim(),
        single: Number(row[2]) || 0,
        group: "", // カテゴリ列は廃止
      });
    } else if (currentSection === "sets2") {
      var valB = String(row[1] || "").trim();
      if (valB !== "") {
        sets2.push([valA, valB, Number(row[2]) || 0]);
      }
    } else if (currentSection === "sets3") {
      var valB = String(row[1] || "").trim();
      var valC = String(row[2] || "").trim();
      if (valB !== "" && valC !== "") {
        sets3.push([valA, valB, valC, Number(row[3]) || 0]);
      }
    } else if (currentSection === "add") {
      add[valA] = Number(row[1]) || 0;
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
 * デフォルトデータに基づいて「マスタ」シートを「縦並び」で自動生成し、初期設定を行います。
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

  // 初期データ
  var defaultProducts = [
    ["shinal", "シナール", 1900],
    ["haichi", "ハイチオール", 2100],
    ["haishi", "ハイシー顆粒", 1900],
    ["trane500", "トラネ500mg「YD」", 3900],
    ["trane250", "トラネ250mg「YD」", 2500],
    ["transa250", "トランサミン250mg", 2700],
    ["transa500", "トランサミン500mg", 4700],
    ["tocoNico", "トコフェロール200mg", 2200],
    ["yubera50", "ユベラ50mg", 2000],
    ["yuberaN100", "ユベラN100mg", 2200],
    ["yuberaN200", "ユベラN200mg", 2700],
    ["noivitan", "ノイロビタン配合錠", 2200],
  ];

  var defaultSets2 = [
    ["shinal", "tocoNico", 3600],
    ["shinal", "trane500", 4800],
    ["shinal", "trane250", 4000],
    ["shinal", "transa250", 4500],
    ["shinal", "transa500", 6000],
    ["shinal", "haichi", 3300],
    ["shinal", "yubera50", 3600],
    ["shinal", "yuberaN100", 3600],
    ["shinal", "yuberaN200", 3900],
    ["haichi", "transa250", 4000],
    ["haichi", "haishi", 3000],
    ["haichi", "yuberaN200", 4300],
    ["haichi", "trane500", 4800],
    ["haichi", "tocoNico", 3700],
    ["trane500", "tocoNico", 5200],
    ["trane500", "yuberaN200", 6000],
  ];

  var defaultSets3 = [
    ["shinal", "trane500", "tocoNico", 5900],
    ["shinal", "trane500", "haichi", 5900],
    ["shinal", "trane500", "yubera50", 5900],
    ["shinal", "trane500", "yuberaN100", 6200],
    ["shinal", "trane500", "yuberaN200", 6400],
    ["shinal", "transa500", "yuberaN200", 7300],
    ["shinal", "haichi", "yubera50", 4700],
    ["shinal", "haichi", "yuberaN100", 4700],
    ["shinal", "haichi", "yuberaN200", 5000],
    ["shinal", "haichi", "tocoNico", 4600],
  ];

  var defaultAdd = [
    ["haichi", 1500],
    ["tocoNico", 1500],
    ["noivitan", 2000],
  ];

  var r = 1; // 行ポインタ

  // 1. 単品価格 (A〜C列)
  sheet.getRange(r, 1, 1, 3).setValues([["単品価格", "", ""]]);
  styleSectionHeader(sheet.getRange(r, 1, 1, 4), "#D4E6F1"); // 薄青
  r++;
  sheet.getRange(r, 1, defaultProducts.length, 3).setValues(defaultProducts);
  r += defaultProducts.length;

  // 空行
  r++;

  // 2. 2種セット (A〜C列)
  sheet.getRange(r, 1, 1, 3).setValues([["2種セット", "", ""]]);
  styleSectionHeader(sheet.getRange(r, 1, 1, 4), "#FCF3CF"); // 薄黄
  r++;
  sheet.getRange(r, 1, defaultSets2.length, 3).setValues(defaultSets2);
  r += defaultSets2.length;

  r++;

  // 3. 3種セット (A〜D列)
  sheet.getRange(r, 1, 1, 4).setValues([["3種セット", "", "", ""]]);
  styleSectionHeader(sheet.getRange(r, 1, 1, 4), "#D5F5E3"); // 薄緑
  r++;
  sheet.getRange(r, 1, defaultSets3.length, 4).setValues(defaultSets3);
  r += defaultSets3.length;

  r++;

  // 4. 追加価格 (A〜B列)
  sheet.getRange(r, 1, 1, 2).setValues([["追加価格", ""]]);
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

  ui.alert("初期設定完了", "「マスタ」シートを縦並び構成で自動生成しました！", ui.ButtonSet.OK);
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
