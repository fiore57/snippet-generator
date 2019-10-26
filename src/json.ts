export interface SnippetData {
    prefix: string;
    body: string;
    description: string;
}

export interface SnippetDataList {
    [key: string]: SnippetData;
}

let jsonText: string = '';
let closeBracketList: number[] = [];
let lastCommaIndex = -1;

// JSON形式のテキストをオブジェクトに変換する
export function parseJson(text: string): SnippetDataList | undefined {
    jsonText = text;
    text = removeCommentFromJson(text);
    let out = text;

    const regexp = /"(\\.|[^"\\])*"/ig
    let result;
    while (result = regexp.exec(text)) {
        let substr = text.slice(result.index, regexp.lastIndex);
        let fixed = substr.replace(/\t/g, '\\t');
        out = out.substring(0, result.index) + fixed + text.substring(regexp.lastIndex);
    }
    return JSON.parse(out);
}

// JSON形式のテキストからコメントを取り除く
export function removeCommentFromJson(text: string) {
    let ret = '';
    let isPrevSlash = false;
    let isInSingleLineComment = false;
    let isInMultiLineComment = false;
    let isPrevAsterisk = false;
    let isInDoubleQuot = false;
    let isEscaping = false;

    let prevCommaIndex = -1;

    let removeCharCount = 0;
    let removeCharCountToComma = 0; // カンマまでのremoveCharCount
    let removeCommaList: { removeCharCount: number, removeCommaIndex: number }[] = [];

    let index = 0;
    for (let c of text) {
        if (isPrevSlash) {      // スラッシュの後の文字
            isPrevSlash = false;
            if (c === '/') {    // 1行コメント
                removeCharCount += 2;
                isInSingleLineComment = true;
            }
            else if (c === '*') {   // 複数行コメント
                removeCharCount += 2;
                isInMultiLineComment = true;
            }
            else {  // 関係ない文字
                ret += '/' + c;
            }
        }
        else if (isInSingleLineComment) {   // 1行コメントの中
            ++removeCharCount;
            if (c === '\n') {   // 1行コメントの終わり
                isInSingleLineComment = false;
            }
        }
        else if (isInMultiLineComment) {    // 複数行コメントの中
            ++removeCharCount;
            if (c === '*') {    // 複数行コメントの終わりかもしれない
                isPrevAsterisk = true;
            }
            else if (isPrevAsterisk) {
                isPrevAsterisk = false;
                if (c === '/') {   // 複数行コメントの終わり
                    isInMultiLineComment = false;
                }
            }
        }
        else if (isInDoubleQuot) {  // ダブルクォートの中
            ret += c;
            if (isEscaping) {   // エスケープ中
                isEscaping = false;
            }
            else if (c === '\\') {  // エスケープ
                isEscaping = true;
            }
            else if (c === '"') {   // ダブルクォートの終わり
                isInDoubleQuot = false;
            }
        }
        else {	// 通常の文字列
            if (c === '/') {    // スラッシュ
                isPrevSlash = true;
            }
            else {
                ret += c;

                if (prevCommaIndex !== -1) {    // カンマの後に「"」「}」「]」がまだない
                    if (c === '"') {    // 正常
                        prevCommaIndex = -1;
                    }
                    else if (c === '}' || c === ']') {  // カンマの削除が必要な場合
                        removeCommaList.push({ removeCommaIndex: prevCommaIndex, removeCharCount: removeCharCountToComma });
                        prevCommaIndex = -1;
                    }
                }
                // not else
                if (c === '"') {
                    isInDoubleQuot = true;
                }
                else if (c === '}') {
                    closeBracketList.push(index);
                }
                else if (c === ',') {
                    prevCommaIndex = index;
                    removeCharCountToComma = removeCharCount;
                    lastCommaIndex = index;
                }
            }
        }
        ++index;
    }

    // ケツカンマの削除
    removeCommaList.reverse();
    for (let removeComma of removeCommaList) {
        ret = ret.slice(0, removeComma.removeCommaIndex - removeComma.removeCharCount) + ret.slice(removeComma.removeCommaIndex - removeComma.removeCharCount + 1);
    }
    return ret;
}

export function insertSnippetToJson(name: string, data: string) {
    let ret = '';
    name = '"' + name + '"';
    if (closeBracketList.length === 0) {
        ret = jsonText + name + ': {' + data + '\n}';
    }
    else if (closeBracketList.length === 1) {
        const insertIndex = closeBracketList[closeBracketList.length - 1];
        ret = jsonText.slice(0, insertIndex) + name + ': ' + data + '\n' + jsonText.slice(insertIndex);
    }
    else {
        const commaIndex = closeBracketList[closeBracketList.length - 2];
        const dataIndex = closeBracketList[closeBracketList.length - 1];
        if (commaIndex < lastCommaIndex && lastCommaIndex < dataIndex) {
            // ケツカンマがある場合
            ret = jsonText.slice(0, dataIndex) + name + ': ' + data + '\n' + jsonText.slice(dataIndex);
        }
        else {
            // ケツカンマがない場合
            ret = jsonText.slice(0, commaIndex + 1) + ',' + jsonText.slice(commaIndex + 1, dataIndex) + name + ': ' + data + '\n' + jsonText.slice(dataIndex);
        }
    }

    // データをクリア
    closeBracketList.length = 0;
    jsonText = '';
    lastCommaIndex = -1;
    return ret;
}