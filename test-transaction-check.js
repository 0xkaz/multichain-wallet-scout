const { CHAINS, checkTransactions } = require('./lib');

// テスト用の既知のウォレットアドレス
const TEST_CASES = [
    {
        address: '0x388c818ca8b9251b393131c08a736a67ccb19297',
        expectedChain: 'ethereum',
        description: 'Ethereumメインネットでトランザクションが存在するアドレス'
    },
    {
        address: '0x35329b841b831A80E14192Bac18922Cb77d3633D',
        expectedChain: 'avalanche',
        description: 'Avalanche C-Chainでトランザクションが存在するアドレス'
    }
];

// 単一のウォレットアドレスのテスト
async function testSingleWallet(testCase) {
    console.log(`\n=== テストケース: ${testCase.description} ===`);
    console.log(`テスト対象アドレス: ${testCase.address}\n`);

    try {
        // 各チェーンでテスト
        for (const [chainId, chain] of Object.entries(CHAINS)) {
            console.log(`${chain.name}のチェック中...`);
            
            const startTime = Date.now();
            const hasTransactions = await checkTransactions(testCase.address, chain);
            const endTime = Date.now();
            
            console.log(`結果: ${hasTransactions ? '✅ トランザクションあり' : '❌ トランザクションなし'}`);
            console.log(`応答時間: ${endTime - startTime}ms`);
            
            // 期待される結果との比較
            if (chainId === testCase.expectedChain) {
                if (hasTransactions) {
                    console.log(`✅ テスト成功: ${chain.name}でトランザクションを正しく検出しました`);
                } else {
                    console.log(`❌ テスト失敗: ${chain.name}でトランザクションを検出できませんでした`);
                    console.log('checkTransactions関数の実装を確認してください');
                }
            }
            
            console.log('------------------------\n');
            
            // チェーン間で少し待機
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } catch (error) {
        console.error('テスト実行中にエラーが発生しました:', error);
    }
}

// すべてのテストケースを実行
async function runAllTests() {
    console.log('トランザクションチェックのテストを開始します...\n');
    
    for (const testCase of TEST_CASES) {
        await testSingleWallet(testCase);
    }
    
    console.log('\nすべてのテストが完了しました');
}

// テストを実行
runAllTests().catch(error => {
    console.error('テスト実行中に予期せぬエラーが発生しました:', error);
});