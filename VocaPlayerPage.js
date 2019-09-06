var Timer = require("FuseJS/Timer");
var Lifecycle = require('FuseJS/Lifecycle');
var FileSystem = require("FuseJS/FileSystem");
var Observable = require('FuseJS/Observable');
var Environment = require('FuseJS/Environment');

var util = require('Utils/Util');
var logger = require("Utils/Logger");
var globals = require('Utils/Globals');
var preference = require("Utils/UserPreference");

var http = require('Server/Http');
var server = require('Server/ServerControl');

var downloader = require('Downloader');
var MediaPlayer = require("NativeMediaPlayer");

var data = require("Routers/RouterData.js");

//재생 속도 조절 변수
var speed = Observable(1.0);

// 현재시간
var currentTime = Observable("00:00");
var currentFlag = false;

var isPlay = Observable(false);

// 총시간
var duration = Observable("00:00");
var takenTime = 0;

// 진행바
var MAX_PROGRESS = Observable(100);
var MIN_PROGRESS = Observable(0);
var PROGRESS = Observable(0);

// 중복 클릭
var isPrevDoubleClicked = false;
var isNextDoubleClicked = false;

// progress timer
var timerID;
var completeTimer;
var progressTimerID;

var prevent1 = true;
var prevent2 = false;
var isActived = false;
var image = Observable("sp10");
var isDeleteMode = Observable(false);

var vocaList = Observable();
var partList = Observable();
var mData;
var	tmp = [];
var cnt;
var currentIndex;
var WRD = Observable();
var INTRPRT = Observable();
var STQEST_FQ = Observable();
var lastDownloadID = -1;
var info = Observable("");
var scrollPosition = 0;

var current_problem_num = 1; //문제 번호

var path = FileSystem.cacheDirectory;

var isCurrent_SORT_ORDR_First = Observable(true); // 첫번째 문제인지 여부
var isCurrent_SORT_ORDR_Last = Observable(false); // 마지막 문제인지 여부
var isPlayAllCompletion = Observable(false); //모든 문제까지 재생이 완료됬는지 여부
var isPlayerInited = false; //플레이어가 준비됐는지 판별

Lifecycle.on("enteringForeground", function() {
    logger.output("VocaPlayerPage on enteringForeground");
});

Lifecycle.on("enteringInteractive", function() {
    logger.output("VocaPlayerPage on enteringInteractive");
});

Lifecycle.on("exitedInteractive", function() {
    logger.output("VocaPlayerPage on exitedInteractive");
});

Lifecycle.on("enteringBackground", function() {
    logger.output("VocaPlayerPage on enteringBackground");
    pause();
});

Lifecycle.on("stateChanged", function(newState) {
    logger.output("VocaPlayerPage on stateChanged " + newState);
});

this.Parameter.onValueChanged(module, function(data) {
	// logger.output("VocaListPage data : " + JSON.stringify(data));
	if(util.isFromOrderPage){
		tmp = data;
	}else{
		mData = data;
	}
});

function onResume(){
	globals.startLoading();
	isActived = true;
	// 현재시간
	currentTime.value = "00:00";
	currentFlag = false;
	// 총시간
	duration.value = "00:00";
	// 진행바
	MAX_PROGRESS.value = 100;
	MIN_PROGRESS.value = 0;
	PROGRESS.value = 0;
		
	if(!util.isFromOrderPage){
		// 받아 온 데이터 vocaList로 변환
		// var toString = JSON.stringify(mData.result.list);
		// var list = JSON.parse(toString);
		var list = mData;

		list.forEach(function(e, index) {
			// 25개까지만 리스트에 추가
			// if(index < 25){
				var hasPARTS_OF_SPEECH_2 = false;
				var hasPARTS_OF_SPEECH_3 = false;
				
				// 단어 품사가 2개 이상인 경우 처리
				if(e.PARTS_OF_SPEECH_2 != ""){
					hasPARTS_OF_SPEECH_2 = true;
					if(e.PARTS_OF_SPEECH_3 != ""){
						hasPARTS_OF_SPEECH_3 = true;
					}
				}
				
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
			        "hasPARTS_OF_SPEECH_2": hasPARTS_OF_SPEECH_2,
			        "PARTS_OF_SPEECH_2": e.PARTS_OF_SPEECH_2,
			        "hasPARTS_OF_SPEECH_3": hasPARTS_OF_SPEECH_3,
			        "PARTS_OF_SPEECH_3": e.PARTS_OF_SPEECH_3
					});
				// }
			});

			// 리스트에서 보여주는 카운트 처리
			totalListCnt = tmp.length;
			cnt = totalListCnt;
			for(var i=0; i<totalListCnt; i++){
				tmp[i].cnt = cnt;
				cnt--;
			}
		}

	currentIndex = 0;
	tmp[0].isPlaying = true;
	vocaList.replaceAll(tmp);
	setVoca();
	globals.stopLoading();
}	

function onPause(){
	logger.output("VocaPlayerPage onPause");
	vocaList.clear();
	tmp = [];

	cnt = 1;

  	isCurrent_SORT_ORDR_First.value = true; //첫번째 문제인지 여부
	isCurrent_SORT_ORDR_Last.value = false; //마지막 문제인지
 	isPlayAllCompletion.value = false; //모든 문제가 종료됐는지

	if (progressTimerID != undefined) {
		Timer.delete(progressTimerID);
		progressTimerID = undefined;
	}

	if (completeTimer != undefined) {
		Timer.delete(completeTimer);
		completeTimer = undefined;
	}
	stop();
 	isActived = false;
 	isDeleteMode.value = false;
 	util.isFromOrderPage = false;
}

/*                             PlayerControl                             */


  function start() {
  	if(isPlayAllCompletion.value){
  		PROGRESS.value = 0;

		currentTime.value = "00:00";

		if (progressTimerID != undefined) {
			Timer.delete(progressTimerID);
			progressTimerID = undefined;
		}
		MediaPlayer.start();
      	isPlay.value = true;
      	setProgress();      	
  	}else{
	    if (isPlayerInited) {
	      MediaPlayer.start();
	      isPlay.value = true;
	    }
	}
  }

  function pause() {
    if (isPlayerInited) {
    	logger.output("VocaPlayer pause");
		MediaPlayer.pause();
		isPlay.value = false;
    }
  }

  function stop() {
    if (isPlayerInited) {
      MediaPlayer.stop();
      isPlay.value = false;
    }
  }

  function isPlaying() {
    if (!isPlayerInited) return false;
    else return MediaPlayer.isPlaying();
  }

  function getDuration() {
    if (!isPlayerInited) return 0;
    else return MediaPlayer.getDuration();
  }

  function getCurrentPosition() {
    if (!isPlayerInited) return 0;
    else return MediaPlayer.getCurrentTime();
  }

  function seekTo(time) {
    if (!isPlayerInited) MediaPlayer.seekTo(0);
    else MediaPlayer.seekTo(time);
  }


/*                                                                       */

// 단어 설정
function setVoca() {
	// logger.output("currentIndex : " + currentIndex);
	// logger.output("totalListCnt : "+totalListCnt);

	WRD.value = tmp[currentIndex].WRD; // 영어 단어
	INTRPRT.value = tmp[currentIndex].INTRPRT;	// 한글 뜻
	STQEST_FQ.value = tmp[currentIndex].STQEST_FQ;	// 출제 빈도

	// 이전에 재생 중이었던 단어 강조 취소
	vocaList.forEach(function(x) {
        x.isPlaying = false;    
    });
	
	// 현재 재생중인 단어 강조
	tmp[currentIndex].isPlaying = true;
	vocaList.replaceAll(tmp);
	
	// 재생중인 예문으로 스크롤 되도록 처리
	scrollPosition = currentIndex*90;
	vocaScrollView.goto(0, scrollPosition);

	// 이전 버튼, 다음 버튼 처리
	// 재생할 단어가 1개일 경우
	if(totalListCnt == 1){
		isCurrent_SORT_ORDR_First.value = true;
		isCurrent_SORT_ORDR_Last.value = true;
	// 재생할 단어가 2개 이상일 경우
	}else{
		if(currentIndex == 0) {
			isCurrent_SORT_ORDR_First.value = true;
			isCurrent_SORT_ORDR_Last.value = false;
		} else if(currentIndex == totalListCnt-1) {
			isCurrent_SORT_ORDR_Last.value = true;
			isCurrent_SORT_ORDR_First.value = false;
		} else {
			isCurrent_SORT_ORDR_First.value = false;
			isCurrent_SORT_ORDR_Last.value = false;
		}
	}
	
	// 단어 음원 번호 처리 및 음원 다운로드
	var SNDSRC = tmp[currentIndex].SNDSRC;
	downloader.fileDownload(JSON.stringify(SNDSRC));
}

// 음원 다운로드 path 처리 및 재생
downloader.onFilePath = function(path) {
  	logger.output("VocaPlayerPage onFilePath path : " + path);
	if(path == undefined) return;

	// logger.output("tmp : " + JSON.stringify(tmp));
	// logger.output("path : " + path);

	playerInit(path);
}

// 다음 예문으로 넘어가는 기능
function Increase_SORT_ORDR() {

	// logger.output("Increase_SORT_ORDR ---------- isActived : " + isActived);

	if(!isActived) return;

	// 연속 클릭 방지
	if(!isNextDoubleClicked) {
		isNextDoubleClicked = true;
		setTimeout(function() {
			isNextDoubleClicked = false;
		}, 1000);
	} else {
		return;
	}

	PROGRESS.value = 0;
	MAX_PROGRESS.value = 0;

	currentTime.value = "00:00";
	duration.value = "00:00";

	if (progressTimerID != undefined) {
		Timer.delete(progressTimerID);
		progressTimerID = undefined;
	}

	pause();

	if(currentIndex < totalListCnt-1) {
		currentIndex++;
	} else {
		return;
	}

 	isPlayAllCompletion.value = false;
	setVoca();
}

// 이전 문제로 돌아가는 기능
function Decrease_SORT_ORDR() {
	if(!isActived) return;

	// 연속 클릭 방지
	if(!isPrevDoubleClicked) {
		isPrevDoubleClicked = true;
		setTimeout(function() {
			isPrevDoubleClicked = false;
		}, 1000);
	} else {
		return;
	}
	PROGRESS.value = 0;
	MAX_PROGRESS.value = 0;

	currentTime.value = "00:00";
	duration.value = "00:00";

	if (progressTimerID != undefined) {
		Timer.delete(progressTimerID);
		progressTimerID = undefined;
	}

	pause();

	if(currentIndex >0){
		currentIndex--;
	}else{
		return;
	}
	
	setVoca();

	isPlayAllCompletion.value = false;
}

function playerInit(filename) {
	if(!isActived) return;

	// currentTime.value = "00:00";
	// duration.value = "00:00";

	MediaPlayer.init(filename);
	MediaPlayer.setSpeed(speed.value.toString());

  isPlayerInited = true;

  start();
  setProgress();
  // start();

  logger.output("init speed: " + speed.value);
}

function setProgress() {
 	if (progressTimerID != undefined) return;

	// 음원 전체 길이 처리
	var d = getDuration();
	var dMin = "00";
	var dSec = "00";
	
	if(d > 60) {
		var mMin = d / 60;
		dMin = numFormat(mMin.toFixed(0));
		dSec = numFormat(d % 60);
	} else {
		dMin = "00";
		// 음원길이가 1초 미만인 음원은 재생이 건너뛰어지는 경우 있어 따로 처리
		if(d < 1){
			// 총 길이 1초 추가 -> 음원 재생 건너뛰어지지 않게 해줌
			d = d * 1 +1;
		}
		dSec = numFormat(d);
		logger.output("change d : "+d);
	}
	MAX_PROGRESS.value = d;
	duration.value = dMin + ":" + dSec;
	// 재생 완료 돼도 다음 문제로 넘어가지 않는 경우가 있어 따로 초를 설정해 줌
	var shortPlaySec = 0;

	// 현재 진행 상황 타이머
  	progressTimerID = Timer.create(function() {
	    //var playing = isPlaying();
	    var playing = isPlay.value;
	    if (playing) {
			var cMin = "00";
			var cSec = "00";

			var position = getCurrentPosition();
			PROGRESS.value = position;

			if(position > 60) {
				var mMin = position / 60;
				cMin = numFormat(mMin.toFixed(0));
				cSec = numFormat(position % 60);
			} else {
				cMin = "00";
				cSec = numFormat(position);
			}

			currentTime.value = cMin + ":" + cSec;

			if(d == position || d == shortPlaySec) {
				// 마지막 문제가 아닐 경우에만 다음 문제로 진행
				if(currentIndex < totalListCnt-1) {
				  	Increase_SORT_ORDR();
				} else {
				  //마지막 문제일때
				  if (progressTimerID != undefined) {
					    Timer.delete(progressTimerID);
					    progressTimerID = undefined;
					    isPlay.value = false;
					    // logger.output("VocaPlayer last voca");
				  	}
				  	isPlayAllCompletion.value = true;
				}
	  		}
	  		shortPlaySec++;
		}
	}, 1000, true);
}

function sliderValueChanged(args) {
	if(Math.ceil(args.value) > getCurrentPosition()
		|| Math.ceil(args.value) < getCurrentPosition()) {

		if(Environment.ios) { // 당분간 ios만 가능
      		seekTo(args.value.toString());
      		logger.output("sliderValueChanged");
		}
	}
}

function numFormat(variable) {
	variable = Number(variable).toString();
	if(Number(variable) < 10 && variable.length == 1)
		variable = "0" + variable;

	return variable;
}

//속도 조절 버튼 제어
function setPlaySpeed(){
	if(util.MODE == "PRD"){
		globals.showToast("아직 준비중인 기능입니다.");
		return;
	}
	if(speed.value == 0.5) {
		speed.value = 0.7;
		image.value = "sp07";
	} else if(speed.value == 0.7) {
		speed.value = 1.0;
		image.value = "sp10";
	} else if(speed.value == 1.0) {
		speed.value = 1.1;
		image.value = "sp11";
	} else if(speed.value == 1.1) {
		speed.value = 1.2;
		image.value = "sp12";
	} else if(speed.value == 1.2) {
		speed.value = 1.5;
		image.value = "sp15";
	} else if(speed.value == 1.5) {
		speed.value = 2.0;
		image.value = "sp20";
	} else if(speed.value == 2.0) {
		speed.value = 0.5;
		image.value = "sp05";
	}
	// logger.output("Speed.value = " + speed.value);
	MediaPlayer.setSpeed(speed.value.toString());
}

function clickDeletePanel(){
	isDeleteMode.value = !isDeleteMode.value;
}

function deleteVoca(args){
	var deleteIndex = totalListCnt - args.data.cnt;
	tmp.splice(deleteIndex,1);
	
	// 리스트에서 보여주는 카운트 다시 처리
	totalListCnt = tmp.length;
	cnt = totalListCnt;
	for(var i=0; i<totalListCnt; i++){
		tmp[i].cnt = cnt;
		cnt--;
	}
	vocaList.replaceAll(tmp);

	// 재생되고 있는 패턴보다 상단의 단어를 삭제할 경우
	if(deleteIndex < currentIndex){
		currentIndex--;
	// 현재 재생중인 단어를 삭제했을 경우 최상단 첫번째 단어부터 다시 재생
	}else if(currentIndex == deleteIndex){
		currentIndex = 0;
		setVoca();
	}
}

function playThis(args){
	// 선택한 단어의 cnt값으로 index 설정해줌
	currentIndex = totalListCnt - args.data.cnt;
	setVoca();
}

// 단어 순서 변경 페이지로 이동
function goToVocaPlayerOrderPage(){
	router.modify({
		how: "Replace",
		path: ["vocaPlayerOrder", tmp],
		transition: "Transition"
	});
}

module.exports = {
	goToVocaPlayerOrderPage,
	vocaList,
	partList,
	onResume,
	onPause,
	WRD,
	INTRPRT,
	STQEST_FQ,
	currentTime,
	duration,
	PROGRESS,
	MIN_PROGRESS,
	MAX_PROGRESS,
	sliderValueChanged,
	isCurrent_SORT_ORDR_Last,
	isCurrent_SORT_ORDR_First,
	setPlaySpeed,
	Increase_SORT_ORDR,
	Decrease_SORT_ORDR,
	speed,
	pause,
	start,
	isPlay,
	image,
	playThis,
	clickDeletePanel,
	deleteVoca,
	isDeleteMode
};
