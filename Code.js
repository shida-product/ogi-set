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
 * 「マスタ」シートからデータを取得し、フロントエンド用のJSONオブジェクトに変換して返します。
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

  // 1行目はヘッダー行のため i = 1 からループ開始
  for (var i = 1; i < data.length; i++) {
    var row = data[i];

    // 商品マスタ (A〜C列: インデックス 0〜2)
    if (row[0] && String(row[0]).trim() !== "") {
      products.push({
        id: String(row[0]).trim(),
        name: String(row[1]).trim(),
        single: Number(row[2]) || 0,
        group: "", // カテゴリ分けは不要のため空文字に固定
      });
    }

    // 2種セット (F〜H列: インデックス 5〜7)
    if (row[5] && String(row[5]).trim() !== "" && row[6] && String(row[6]).trim() !== "") {
      sets2.push([String(row[5]).trim(), String(row[6]).trim(), Number(row[7]) || 0]);
    }

    // 3種セット (J〜M列: インデックス 9〜12)
    if (
      row[9] &&
      String(row[9]).trim() !== "" &&
      row[10] &&
      String(row[10]).trim() !== "" &&
      row[11] &&
      String(row[11]).trim() !== ""
    ) {
      sets3.push([
        String(row[9]).trim(),
        String(row[10]).trim(),
        String(row[11]).trim(),
        Number(row[12]) || 0,
      ]);
    }

    // 追加価格 (O〜P列: インデックス 14〜15)
    if (row[14] && String(row[14]).trim() !== "") {
      add[String(row[14]).trim()] = Number(row[15]) || 0;
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
 * デフォルトデータに基づいて「マスタ」シートを自動生成し、初期設定を行います。
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

  // 1. 各テーブルのヘッダー書き込み
  sheet.getRange("A1:C1").setValues([["商品ID", "商品名", "単品価格"]]);
  sheet.getRange("F1:H1").setValues([["薬A_ID", "薬B_ID", "セット価格"]]);
  sheet.getRange("J1:M1").setValues([["薬A_ID", "薬B_ID", "薬C_ID", "セット価格"]]);
  sheet.getRange("O1:P1").setValues([["商品ID", "追加価格"]]);

  // 2. データの書き込み
  if (defaultProducts.length > 0) {
    sheet.getRange(2, 1, defaultProducts.length, 3).setValues(defaultProducts);
  }
  if (defaultSets2.length > 0) {
    sheet.getRange(2, 6, defaultSets2.length, 3).setValues(defaultSets2);
  }
  if (defaultSets3.length > 0) {
    sheet.getRange(2, 10, defaultSets3.length, 4).setValues(defaultSets3);
  }
  if (defaultAdd.length > 0) {
    sheet.getRange(2, 15, defaultAdd.length, 2).setValues(defaultAdd);
  }

  // 3. ヘッダーのデザイン装飾
  var headerBgColor = "#D4E6F1"; // 薄いブルーグレー
  var headerRanges = ["A1:C1", "F1:H1", "J1:M1", "O1:P1"];
  headerRanges.forEach(function (rangeStr) {
    var range = sheet.getRange(rangeStr);
    range.setFontWeight("bold");
    range.setBackground(headerBgColor);
    range.setHorizontalAlignment("center");
  });

  // 格子線の描画
  var lastRow = sheet.getLastRow();
  if (lastRow > 0) {
    sheet
      .getRange(1, 1, lastRow, 16)
      .setBorder(true, true, true, true, true, true, "#D0D3D4", SpreadsheetApp.BorderStyle.SOLID);
  }

  // 4. 列幅の自動調整
  for (var col = 1; col <= 16; col++) {
    sheet.autoResizeColumn(col);
  }
  // 境界列（空白列）の幅を意図的に狭めて見栄えを整える
  sheet.setColumnWidth(5, 30);
  sheet.setColumnWidth(9, 30);
  sheet.setColumnWidth(14, 30);

  ui.alert(
    "初期設定完了",
    "「マスタ」シートの生成と初期データの配置が完了しました！",
    ui.ButtonSet.OK
  );
}
