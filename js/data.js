/*
 * 게임 데이터
 * - 장 4개, 장마다 몬스터 HP 10 = 문제 10개
 * - 문제 내용은 아직 미정이라 빈 슬롯으로 둔다.
 * - flagHash 가 null 인 문제는 테스트 플래그(test)로 통과한다.
 * - 실제 플래그 해시: node -e "console.log(require('crypto').createHash('sha256').update('플래그').digest('hex'))"
 */
window.GAME_DATA = {
  brand: 'KLOAD',
  maxHp: 10,
  testFlagHash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', // "test"

  chapters: [
    {
      id: 1,
      name: '커피나무',
      goal: '길을 따라 올라가며 숲의 수호자에게서 열매를 빼앗아 보세요',
      monster: '숲의 수호자',
      art: 'tree',
      portrait: 'assets/ch1-portrait.webp',
      intro: '숲의 수호자 커피나무가 나타났다!',
      hitLine: '나무에 칼집이 하나 늘었다.',
      clearLine: '커피나무가 쓰러지며 열매를 떨어뜨렸다!'
    },
    {
      id: 2,
      name: '열매 군단',
      goal: '열매 군단 10명을 한 명씩 물리쳐 생두를 얻어 보세요',
      monster: '커피 열매 군단',
      art: 'berries',
      intro: '커피 열매 군단이 길을 막아섰다!',
      hitLine: '열매 병사 하나가 쓰러졌다.',
      clearLine: '열매 군단을 물리치고 생두를 얻었다!'
    },
    {
      id: 3,
      name: '로스팅',
      goal: '불을 키워 생두를 노릇한 원두로 볶아 보세요',
      monster: '불판 위의 생두',
      art: 'greenbean',
      intro: '생두가 불판 위에서 버티고 있다!',
      hitLine: '불길이 한층 더 거세졌다.',
      clearLine: '생두가 노릇하게 볶아져 원두가 되었다!'
    },
    {
      id: 4,
      name: '추출',
      goal: '원두를 새까맣게 물들여 커피로 만들어 보세요',
      monster: '고집 센 원두',
      art: 'roastbean',
      intro: '원두가 마지막으로 저항한다!',
      hitLine: '원두가 더 검게 물들었다.',
      clearLine: '원두가 새까만 커피로 변했다!'
    }
  ],

  // 장별 문제 10개 (빈 슬롯). 문제가 정해지면 title, desc, flagHash 를 채운다. url 에 http(s) 주소를 넣으면 '문제보기' 창 안에 문제 페이지가 열린다.
  problems: [1, 2, 3, 4].map(function (ch) {
    var list = [];
    for (var i = 1; i <= 10; i++) {
      list.push({ ch: ch, no: i, title: '', desc: '', url: '', flagHash: null });
    }
    return list;
  })
};
