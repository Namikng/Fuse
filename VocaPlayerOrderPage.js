var Observable = require('FuseJS/Observable');
var util = require('Utils/Util');
var logger = require("Utils/Logger");
var globals = require('Utils/Globals');

var tmp;
var vocaList = Observable();
var selected = null;
var reordering = Observable(false);

this.Parameter.onValueChanged(module, function(data) {
	// 단어 플레이어 리스트를 그대로 가져옴
	vocaList.replaceAll(data);
	// vocaList에 selected 속성 Observable로 추가
	vocaList.forEach(function(x) {
        x.selected = Observable(false);     
    });
});

function onResume(){
}	

function onPause(){
	logger.output("VocaPlayerOrderPage onPause");
}

// 단어 선택 시 처리
function select(args) {
    if (selected === null) {
        selected = args.data.cnt;
        vocaList.forEach(function(x) {
            if (x.cnt === selected) {
                x.selected.value = true;
            }
        });
    }
    reordering.value = true;
}

// 단어 선택 해제 시 처리
function deselect() {
    selected = null;
    vocaList.forEach(function(x) {
        x.selected.value = false;
    });
    
    // 리스트에서 보여주는 카운트 처리
    tmp = vocaList.toArray();
	var totalListCnt = tmp.length;
	var newCnt = totalListCnt;
	for(var i=0; i<totalListCnt; i++){
		tmp[i].cnt = newCnt;
		newCnt--;
	}
    vocaList.replaceAll(tmp);
    reordering.value = false;
}

// 단어 순서변경 처리
function hover(args) {
    if (reordering.value === true && selected !== null) {
        var from;
        var to;
        vocaList.forEach(function(item, index) {
            if (item.cnt === selected) {
                from = index;
            }
            if (item.cnt === args.data.cnt) {
                to = index;
            }
        });
        if (to !== from && to !== undefined) {
            tmp = vocaList.toArray();
            var elem = tmp[from];
            tmp.splice(from, 1);
            tmp.splice(to, 0, elem);
            vocaList.replaceAll(tmp);
        }
    }
}

// 단어 플레이어로 돌아감(변경된 리스트 보내줘야 해서 goBack 사용하지 않음)
function goBackToVocaPlayer(){
	// vocaList에 selected 속성 Observable 아니도록 처리
	vocaList.forEach(function(x) {
        x.selected = false;     
    });
	tmp = vocaList.toArray();
	util.isFromOrderPage = true;
	
	router.modify({
		how: "Replace",
		path: ["vocaPlayer", tmp],
		transition: "Transition"
	});
}

module.exports = {
	vocaList,
	reordering,
	select,
	deselect,
	hover,
	goBackToVocaPlayer
};
