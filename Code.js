function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("セット会計").addItem("セット会計サポートを起動", "showDialog").addToUi();

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
    var valB = String(row[1] || "").trim();
    var valC = String(row[2] || "").trim();
    var valD = String(row[3] || "").trim();

    if (valA === "") continue;

    // ヘッダー行を検知してセクションを切り替える
    // 1. 単品価格 (A列が "商品名" または "単品価格")
    if (valA === "商品名" || valA === "単品価格") {
      currentSection = "products";
      continue;
    }
    // 2. 2種セット (A列が "2種セット")
    if (valA === "2種セット") {
      currentSection = "sets2";
      continue;
    }
    // 3. 3種セット (A列が "3種セット")
    if (valA === "3種セット") {
      currentSection = "sets3";
      continue;
    }
    // 4. 追加価格 (A列が "4種目以降の追加" または "追加価格")
    if (valA === "4種目以降の追加" || valA.indexOf("追加価格") !== -1) {
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
