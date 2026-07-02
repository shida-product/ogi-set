/**
 * スプレッドシート起動時の処理。
 * カスタムメニューを追加します。
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('セット会計')
    .addItem('セット会計サポートを起動', 'showSidebar')
    .addToUi();
}

/**
 * サイドバーにUI（index.html）を表示します。
 */
function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('index')
    .setTitle('セット会計サポート')
    .setWidth(400);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * 「マスタ」シートからデータを取得し、フロントエンド用のJSONオブジェクトに変換して返します。
 * @return {Object} マスタデータ
 */
function getMasterData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('マスタ');
  if (!sheet) {
    console.warn('「マスタ」シートが見つかりません');
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
    
    // 商品マスタ (A〜D列: インデックス 0〜3)
    if (row[0] && String(row[0]).trim() !== '') {
      products.push({
        id: String(row[0]).trim(),
        name: String(row[1]).trim(),
        single: Number(row[2]) || 0,
        group: String(row[3]).trim()
      });
    }
    
    // 2種セット (F〜H列: インデックス 5〜7)
    if (row[5] && String(row[5]).trim() !== '' && row[6] && String(row[6]).trim() !== '') {
      sets2.push([
        String(row[5]).trim(),
        String(row[6]).trim(),
        Number(row[7]) || 0
      ]);
    }
    
    // 3種セット (J〜M列: インデックス 9〜12)
    if (row[9] && String(row[9]).trim() !== '' && row[10] && String(row[10]).trim() !== '' && row[11] && String(row[11]).trim() !== '') {
      sets3.push([
        String(row[9]).trim(),
        String(row[10]).trim(),
        String(row[11]).trim(),
        Number(row[12]) || 0
      ]);
    }
    
    // 追加価格 (O〜P列: インデックス 14〜15)
    if (row[14] && String(row[14]).trim() !== '') {
      add[String(row[14]).trim()] = Number(row[15]) || 0;
    }
  }
  
  return {
    products: products,
    sets2: sets2,
    sets3: sets3,
    add: add
  };
}
