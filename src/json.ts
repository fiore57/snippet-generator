export interface SnippetData {
  prefix: string;
  body: string;
  description: string;
}

export interface SnippetDataList {
  [key: string]: SnippetData;
}

class Tmp<T> {
  private _val: T | null = null;
  public constructor(init?: T) {
    if (init !== undefined) {
      this._val = init;
    }
  }
  public set(val: T) {
    this._val = val;
  }
  public getAndClear(): T {
    const ret = this._val;
    this._val = null;
    if (ret === null) {
      console.error("メッセージは でないはずだよ");
      throw new Error();
    }
    return ret;
  }
}

let jsonTextTmp = new Tmp<string>();
let closeBracketList: number[] = [];
let lastCommaIndexTmp = new Tmp<number>(-1);

// JSON形式のテキストをオブジェクトに変換する
export function parseJson(text: string): SnippetDataList | undefined {
  jsonTextTmp.set(text);
  text = removeCommentFromJson(text);
  if (closeBracketList.length === 0) {
    // テキストが空の場合
    return {};
  }
  let out = text;

  const regexp = /"(\\.|[^"\\])*"/gi;
  let result;
  while ((result = regexp.exec(text))) {
    let substr = text.slice(result.index, regexp.lastIndex);
    let fixed = substr.replace(/\t/g, "\\t");
    out =
      out.substring(0, result.index) + fixed + text.substring(regexp.lastIndex);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    console.log(e);
    return undefined;
  }
}

// JSON形式のテキストからコメントを取り除く
export function removeCommentFromJson(text: string) {
  let ret = "";
  let isPrevSlash = false;
  let isInSingleLineComment = false;
  let isInMultiLineComment = false;
  let isPrevAsterisk = false;
  let isInDoubleQuot = false;
  let isEscaping = false;

  let prevCommaIndex = -1;

  let removeCharCount = 0;
  let removeCharCountToComma = 0; // カンマまでのremoveCharCount
  let removeCommaList: {
    removeCharCount: number;
    removeCommaIndex: number;
  }[] = [];

  let index = 0;
  for (let c of text) {
    if (isPrevSlash) {
      // スラッシュの後の文字
      isPrevSlash = false;
      if (c === "/") {
        // 1行コメント
        removeCharCount += 2;
        isInSingleLineComment = true;
      } else if (c === "*") {
        // 複数行コメント
        removeCharCount += 2;
        isInMultiLineComment = true;
      } else {
        // 関係ない文字
        ret += "/" + c;
      }
    } else if (isInSingleLineComment) {
      // 1行コメントの中
      ++removeCharCount;
      if (c === "\n") {
        // 1行コメントの終わり
        isInSingleLineComment = false;
      }
    } else if (isInMultiLineComment) {
      // 複数行コメントの中
      ++removeCharCount;
      if (c === "*") {
        // 複数行コメントの終わりかもしれない
        isPrevAsterisk = true;
      } else if (isPrevAsterisk) {
        isPrevAsterisk = false;
        if (c === "/") {
          // 複数行コメントの終わり
          isInMultiLineComment = false;
        }
      }
    } else if (isInDoubleQuot) {
      // ダブルクォートの中
      ret += c;
      if (isEscaping) {
        // エスケープ中
        isEscaping = false;
      } else if (c === "\\") {
        // エスケープ
        isEscaping = true;
      } else if (c === '"') {
        // ダブルクォートの終わり
        isInDoubleQuot = false;
      }
    } else {
      // 通常の文字列
      if (c === "/") {
        // スラッシュ
        isPrevSlash = true;
      } else {
        ret += c;

        if (prevCommaIndex !== -1) {
          // カンマの後に「"」「}」「]」がまだない
          if (c === '"') {
            // 正常
            prevCommaIndex = -1;
          } else if (c === "}" || c === "]") {
            // カンマの削除が必要な場合
            removeCommaList.push({
              removeCommaIndex: prevCommaIndex,
              removeCharCount: removeCharCountToComma,
            });
            prevCommaIndex = -1;
          }
        }
        // not else
        if (c === '"') {
          isInDoubleQuot = true;
        } else if (c === "}") {
          closeBracketList.push(index);
        } else if (c === ",") {
          prevCommaIndex = index;
          removeCharCountToComma = removeCharCount;
          lastCommaIndexTmp.set(index);
        }
      }
    }
    ++index;
  }

  // ケツカンマの削除
  removeCommaList.reverse();
  for (let removeComma of removeCommaList) {
    ret =
      ret.slice(0, removeComma.removeCommaIndex - removeComma.removeCharCount) +
      ret.slice(removeComma.removeCommaIndex - removeComma.removeCharCount + 1);
  }
  return ret;
}

export function insertSnippetToJson(name: string, data: string) {
  let ret = "";

  function replacer(
    _match: string,
    _p1: string,
    p2: string,
    _offset: number,
    _string: string
  ) {
    return "\t" + p2;
  }
  // 2行目以降の行頭にタブを挿入
  data = data.replace(/((?<=\n))(.)/g, replacer);
  /*
        data
    {                               <- Tabなし
            "prefix": "***";
            "body": "***";
            "description": "***";
        }
    */

  const text = jsonTextTmp.getAndClear();
  const insertText = `\t"${name}": ${data}\n`;

  if (closeBracketList.length === 0) {
    ret = text + "{\n" + insertText + "}";
  } else if (closeBracketList.length === 1) {
    const insertIndex = closeBracketList[closeBracketList.length - 1];
    ret =
      text.slice(0, insertIndex) + "\n" + insertText + text.slice(insertIndex);
  } else {
    const commaIndex = closeBracketList[closeBracketList.length - 2];
    const dataIndex = closeBracketList[closeBracketList.length - 1];
    const lastCommaIndex = lastCommaIndexTmp.getAndClear();
    if (commaIndex < lastCommaIndex && lastCommaIndex < dataIndex) {
      // ケツカンマがある場合
      ret = text.slice(0, dataIndex) + insertText + text.slice(dataIndex);
    } else {
      // ケツカンマがない場合
      ret =
        text.slice(0, commaIndex + 1) +
        "," +
        text.slice(commaIndex + 1, dataIndex) +
        insertText +
        text.slice(dataIndex);
    }
  }

  // データをクリア
  closeBracketList.length = 0;
  return ret;
}
