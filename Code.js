/**
 * スプレッドシート起動時の処理。
 * カスタムメニューを追加します。
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("セット会計").addItem("セット会計サポートを起動", "showSidebar").addToUi();
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
 * 各マスタシートからデータを取得し、フロントエンド用のJSONオブジェクトに変換して返します。
 * @return {Object} マスタデータ
 */
function getMasterData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 各シートからデータを読み取る
  var products = getProductsFromSheet(ss.getSheetByName("マスタ_商品"));
  var sets2 = getSets2FromSheet(ss.getSheetByName("マスタ_2種セット"));
  var sets3 = getSets3FromSheet(ss.getSheetByName("マスタ_3種セット"));
  var add = getAddPricesFromSheet(ss.getSheetByName("マスタ_追加価格"));

  return {
    products: products,
    sets2: sets2,
    sets3: sets3,
    add: add,
  };
}

/**
 * 商品マスタシートから商品情報を取得します。
 * @param {Sheet} sheet 対象シート
 * @return {Array<Object>} 商品配列
 */
function getProductsFromSheet(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var products = [];
  // 1行目はヘッダー: [商品ID, 商品名, 単品価格, グループ]
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue; // IDが空ならスキップ
    products.push({
      id: String(row[0]).trim(),
      name: String(row[1]).trim(),
      single: Number(row[2]) || 0,
      group: String(row[3]).trim(),
    });
  }
  return products;
}

/**
 * 2種セットマスタシートからセット情報を取得します。
 * @param {Sheet} sheet 対象シート
 * @return {Array<Array>} 2種セット配列
 */
function getSets2FromSheet(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var sets2 = [];
  // 1行目はヘッダー: [薬A_ID, 薬B_ID, セット価格]
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0] || !row[1]) continue;
    sets2.push([String(row[0]).trim(), String(row[1]).trim(), Number(row[2]) || 0]);
  }
  return sets2;
}

/**
 * 3種セットマスタシートからセット情報を取得します。
 * @param {Sheet} sheet 対象シート
 * @return {Array<Array>} 3種セット配列
 */
function getSets3FromSheet(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var sets3 = [];
  // 1行目はヘッダー: [薬A_ID, 薬B_ID, 薬C_ID, セット価格]
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0] || !row[1] || !row[2]) continue;
    sets3.push([
      String(row[0]).trim(),
      String(row[1]).trim(),
      String(row[2]).trim(),
      Number(row[3]) || 0,
    ]);
  }
  return sets3;
}

/**
 * 追加価格マスタシートから情報を取得します。
 * @param {Sheet} sheet 対象シート
 * @return {Object} 追加価格マッピング
 */
function getAddPricesFromSheet(sheet) {
  if (!sheet) return {};
  var data = sheet.getDataRange().getValues();
  var add = {};
  // 1行目はヘッダー: [商品ID, 追加価格]
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    add[String(row[0]).trim()] = Number(row[1]) || 0;
  }
  return add;
}
