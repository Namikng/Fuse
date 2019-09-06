var Observable = require('FuseJS/Observable');
var Environment = require('FuseJS/Environment');

var util = require('Utils/Util');
var globals = require('Utils/Globals');
var preference = require("Utils/UserPreference");
var toast = require("deviceToast");
var logger = require('Utils/Logger');

var http = require('Server/Http');
var server = require('Server/ServerControl');

var settings = require('UserSettings');
var downloader = require('Downloader');
var MediaPlayer = require("NativeMediaPlayer");
var FileSystem = require("FuseJS/FileSystem");

var loginInfo = require('pages/LoginPage');

var mData;
var totalListCnt = 0;
var currentListCnt = 0;

var genius_mode = 0;
var manage_no = 0;

var listeningList = Observable();

var footerText = Observable("더보기(0/0)");
var footerBarVisible = Observable("Collapsed");

var word_note_se = "AA540001";

//중복 방지용 변수
var prevent1 = false;
var prevent2 = false;

var isDoubleClicked1 = false;
var isDoubleClicked2 = false;

var oldTmp = [];
var	tmp = [];
var cnt = 0;

var empty_text = Observable("");
var empty_sub_text = Observable("");
var memorizeText = "단어는 외워도 외워도 뒤돌아서면 까먹어요.\n영어공부에 있어서 단어암기는 아주 중요해요.\n절대 잊어버리지 않고 단어를 기억하기 위해서는\n그 단어를 우리가 최대한 많이 보아야해요.\n\n그래서 하우투리슨 Genius에서는\n완전암기 단어를 복습단어장으로 만들었어요.\n완전암기했다 생각하는\n단어는 복습단어장에서 확인해보세요.";
var isMemorizePanelVisible = Observable(false);
var memorizeWordSn;
var titleText = Observable();

var isEmpty = Observable(false);
var isPlayerInited = false; //플레이어가 준비됐는지 판별
var path = FileSystem.cacheDirectory;
var isActived = false;
var isVoca_SelectAll = Observable(false);

this.Parameter.onValueChanged(module, function(data) {
	if(data == undefined) return;
	word_note_se = data;
	// 각 단어장 별 텍스트 처리
	switch(word_note_se){
		case "AA540001":
		titleText.value = "오답 단어장";
		empty_text.value = "오답단어가 없습니다.";
		empty_sub_text.value = "모든 숙제에 만점을 받으셨나요?\n그렇지 않다면 응시한 숙제가 없으시군요.\n숙제에 응시하시면 지니어스가 자동으로\n오답단어를 정리해줍니다.";
		break;

		case "AA540002":
		titleText.value = "복습 단어장";
		empty_text.value = "등록된 복습 단어가 없습니다."
		empty_sub_text.value = "오답 단어를 암기완료 하시면\n복습 단어장으로 이동됩니다.";
		break;

		case "AA540003":
		titleText.value = "복복습 단어장";
		empty_text.value = "등록된 복복습 단어가 없습니다."
		empty_sub_text.value = "복습 단어를 암기완료 하시면\n복복습 단어장으로 이동됩니다.";
		break;

		case "AA540004":
		titleText.value = "완전암기 단어장";
		empty_text.value = "등록된 완전암기 단어가 없습니다."
		empty_sub_text.value = "복복습단어를 암기완료 하시면\n완전암기 단어장으로 이동됩니다.";
		break;
	}
});

//ux파일이 Activated일때 작동
function onResume() {
	logger.output("VocaListPage onResume");

	if(Environment.mobile) {
		//인터넷 연결 확인
		var isConnected = http.isConnected();
		if(isConnected == false) {
			logger.output("Internet Not Connected");
			return;
		}

		genius_mode = preference.getGeniusMode();
		manage_no = preference.getMNO();

		cnt = 0;
		prevent1 = true;
		globals.startLoading();

		var param = {"page": 0, "word_note_se": word_note_se};

		if(genius_mode == 1) {
			param.sdyrum_manage_no = manage_no;
			http.request(http.LISTEN_LIST_WORD2, param);
		} else {
			http.request(http.LISTEN_LIST_WORD1, param);
		}
	} else {
		prevent2 = true;
		server.requestListenListIncrct(param);
	}
}

//ux파일 Deactived일때 실행됨
function onPause() {
	prevent1 = false;
	prevent2 = false;
	isMemorizePanelVisible.value = false;

	listeningList.clear();

	totalListCnt = 0;
	currentListCnt = 0;

	footerText.value = "더보기(0/0)";
	footerBarVisible.value = "Collapsed";

	oldTmp = [];
	tmp = [];

	stop();
 	isActived = false;

}

function showMoreList() {
	if (!isDoubleClicked1) {
		isDoubleClicked1 = true;

		setTimeout(function () {
			isDoubleClicked1 = false;
		}, 1000);
	} else {
		return;
	}

	//	보여지고있는 리스트 개수와 총 리스트 개수와 같을 경우 더 이상 리스트 호출하지 않음
	if(currentListCnt == totalListCnt) return;
	prevent1 = true;

	var pageNum = currentListCnt / 25 + 1;
	var param = {"page": pageNum, "word_note_se": word_note_se};

	globals.startLoading();

	if(Environment.mobile) {
		if(genius_mode == 1) {
			param.sdyrum_manage_no = manage_no;
			http.request(http.LISTEN_LIST_WORD2, param);
		} else {
			http.request(http.LISTEN_LIST_WORD1, param);
		}
	} else {
		server.requestListenListIncrct(param);
	}
}

// 서버 통신 결과
// Downloader.onResult = function(response) {
http.resultListenListWord.onValueChanged(module, function(response) {
	if(response == undefined) return;

	if(prevent1) {
		var mResult = JSON.parse(response);
		mData = JSON.parse(mResult);

		if(cnt == 0){
			cnt = mData.result.cnt;
			totalListCnt = cnt;
		}

		// 리스트가 없을 경우 retrun
		if(cnt <= 0) {
			isEmpty.value = true;
			globals.stopLoading();
			return;
		}

		isEmpty.value = false;
		logger.output("isEmpty : "+isEmpty.value);

		var toString = JSON.stringify(mData.result.list);
		var list = JSON.parse(toString);

		tmp = [];

		list.forEach(function(e) {
			var isNew = false;
			if(e.NEW_YN == "Y") isNew = true;

			tmp.push({
		        "WORD_NOTE_SE": e.WORD_NOTE_SE,
		        "WRD_NOTE_SN": e.WRD_NOTE_SN,
		        "WRD": e.WRD,
		        "INTRPRT": e.INTRPRT,
		        "WRD_NO": e.WRD_NO,
		        "MEMORZ_STTUS_SE": e.MEMORZ_STTUS_SE,
		        "IPCR": e.IPCR,
		        "SNDSRC": e.SNDSRC,
		        "STQEST_FQ": e.STQEST_FQ,
		        "STDNT_ID": e.STDNT_ID,
		        "NEW_YN": e.NEW_YN,
		        "PARTS_OF_SPEECH_1": e.PARTS_OF_SPEECH_1,
		        "PARTS_OF_SPEECH_2": e.PARTS_OF_SPEECH_2,
		        "PARTS_OF_SPEECH_3": e.PARTS_OF_SPEECH_3,
		        "isNew": isNew,
		        "cnt": cnt,
		        "checked": Observable(false)
			});
			cnt--;
		});

		listeningList.addAll(tmp);
		currentListCnt = listeningList.length;

		// 페이지가 남아 있을 경우
		if(currentListCnt < totalListCnt) {
			footerBarVisible.value = "Visible";
			footerText.value = "25개 더보기(" + currentListCnt + "/" + totalListCnt + ")";
		} else {
			footerBarVisible.value = "Visible";
			footerText.value = "마지막 페이지입니다(" + currentListCnt + "/" + totalListCnt + ")";
		}

		prevent1 = false;
		globals.stopLoading();
	}
});

//preview 서버통신
server.resultListenListWord.onValueChanged(module, function(data) {
	if(prevent2) {
		// logger.output("LISTEN_LIST_INCRCT");
		// logger.output("data : " + data);

		if(data == undefined) return;
		var mData = JSON.parse(data);
		var results = mData.result;
	}
});

// 전체선택
function selectAll(){
	if(isVoca_SelectAll.value){
			listeningList.forEach(function(x) {
        	x.checked.value = false;
    	});
		isVoca_SelectAll.value = false;
	}else{
		listeningList.forEach(function(x) {
        	x.checked.value = true;
    	});
    	isVoca_SelectAll.value = true;
	}
}

// 단어 선택 시 처리
function toggleItem(arg) {
	var selected = arg.data.cnt;
    listeningList.forEach(function(x) {
        if (x.cnt === selected) {
        	x.checked.value = !x.checked.value;
        }
    });
}

function goToVocaPlayerPage() {
	// 체크된 리스트만 다시 tmp에 넣어서 단어 플레이어로 넘겨줌
	tmp = [];
	listeningList.forEach(function(e) {
        if (e.checked.value) {
        	tmp.push({
		        "WORD_NOTE_SE": e.WORD_NOTE_SE,
		        "WRD_NOTE_SN": e.WRD_NOTE_SN,
		        "WRD": e.WRD,
		        "INTRPRT": e.INTRPRT,
		        "WRD_NO": e.WRD_NO,
		        "MEMORZ_STTUS_SE": e.MEMORZ_STTUS_SE,
		        "IPCR": e.IPCR,
		        "SNDSRC": e.SNDSRC,
		        "STQEST_FQ": e.STQEST_FQ,
		        "STDNT_ID": e.STDNT_ID,
		        "PARTS_OF_SPEECH_1": e.PARTS_OF_SPEECH_1,
		        "PARTS_OF_SPEECH_2": e.PARTS_OF_SPEECH_2,
		        "PARTS_OF_SPEECH_3": e.PARTS_OF_SPEECH_3
			});
        }
    });
    // 선택한 단어가 있는지 확인
    if(tmp.length > 0){
    	router.push("vocaPlayer", tmp);
    }else{
    	globals.showToast("선택된 단어가 없습니다.");
    }
}

// 해당 단어 음원 재생
function playWord(args){
	globals.startLoading();
	var SNDSRC = args.data.SNDSRC;
	// logger.output("playWord SNDSRC : "+JSON.stringify(SNDSRC));
	downloader.fileDownload(JSON.stringify(SNDSRC));
	globals.stopLoading();
}

function start() {
    if (isPlayerInited) {
		MediaPlayer.start();
		// isPlay.value = true;
    }
}

function stop() {
    if (isPlayerInited) {
		MediaPlayer.stop();
		// isPlay.value = false;
    }
}

function playerInit(filename) {
	// if(!isActived) return;
	logger.output("playerInit");
	MediaPlayer.init(filename);
	isPlayerInited = true;
	start();
}

// 음원 다운로드 path 처리 및 재생
downloader.onFilePath = function(path) {
  	logger.output("VocaListPage onFilePath path : " + path);
	if(path == undefined) return;
	playerInit(path);
}

function clickMemorizeButton(args){
	isMemorizePanelVisible.value = true;
	// 해당 단어 WRD_NOTE_SN 저장
	memorizeWordSn = args.data.WRD_NOTE_SN;
}

function closePanel(){
	isMemorizePanelVisible.value = false;
}

// 암기완료 서버통신 요청
function memorize(){
	if(!isDoubleClicked2) {
		isDoubleClicked2 = true;

		setTimeout(function () {
			isDoubleClicked2 = false;
		}, 1000);
	} else {
		return;
	}

	var param = {"sdyrum_manage_no":manage_no,"wrd_note_sn_list":[memorizeWordSn]};

	//인터넷 연결 확인
	var isConnected = http.isConnected();
	if(isConnected == false) {
		logger.output("Internet Not Connected");
		return;
	}
	prevent1 = true;
	globals.startLoading();
	http.request(http.WORD_MEMORIZE, param);
}

// 암기 완료 서버통신 결과
http.resultWordMemorize.onValueChanged(module, function(response) {
	if(response == undefined) return;

	if(prevent1) {
		var mResult = JSON.parse(response);
		var mData = JSON.parse(mResult);
		if(mData.result.cnt !== 1){
			globals.showToast("오류가 발생했습니다. 다시 시도해주세요.");
		}
	}
	globals.stopLoading();
	onPause();
	onResume();
});

module.exports = {
	onResume,
	onPause,
	goToVocaPlayerPage,
	listeningList,
	showMoreList,
	footerText,
	footerBarVisible,
	memorizeText,
	isMemorizePanelVisible,
	isEmpty,
	empty_text,
	empty_sub_text,
	playWord,
	selectAll,
	toggleItem,
	isVoca_SelectAll,
	clickMemorizeButton,
	closePanel,
	memorize,
	titleText
};
