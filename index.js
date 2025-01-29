const {
    CHAINS,
    initializeDatabase,
    saveMnemonic,
    saveWallet,
    saveActiveWallet,
    generateWalletsFromMnemonic,
    checkTransactions,
    updateTransactionFlags,
    generateMnemonic
} = require('./lib');

// メイン処理
async function main() {
    const db = initializeDatabase();

    try {
        // ニーモニックフレーズを生成
        const mnemonic = generateMnemonic();
        console.log('生成されたニーモニックフレーズ:', mnemonic);

        // ニーモニックフレーズを保存
        const mnemonicId = await saveMnemonic(db, mnemonic);
        console.log('ニーモニックフレーズを保存しました');

        // ウォレットを生成
        const wallets = await generateWalletsFromMnemonic(mnemonic);
        console.log('生成されたウォレット:');
        wallets.forEach((wallet, index) => {
            console.log(`ウォレット ${index + 1}:`);
            console.log(`  アドレス: ${wallet.address}`);
            console.log(`  プライベートキー: ${wallet.privateKey}`);
            console.log(`  導出パス: ${wallet.derivationPath}`);
        });

        // 各ウォレットを処理
        for (const wallet of wallets) {
            // ウォレット情報を保存
            await saveWallet(db, mnemonicId, wallet, wallet.derivationPath);
            console.log(`ウォレット保存完了: ${wallet.address}`);

            // 各チェーンでトランザクションをチェック
            const chainResults = {};
            for (const [chainId, chain] of Object.entries(CHAINS)) {
                const hasTransactions = await checkTransactions(wallet.address, chain);
                chainResults[chainId] = hasTransactions;
                console.log(`${chain.name}のトランザクション存在:`, hasTransactions);

                // トランザクションがある場合、アクティブウォレットとして保存
                if (hasTransactions) {
                    await saveActiveWallet(db, wallet, chain.name);
                    console.log(`アクティブウォレットとして保存: ${chain.name}`);
                }
            }

            // トランザクションフラグを更新
            await updateTransactionFlags(db, wallet, chainResults);
            console.log(`トランザクションフラグを更新しました: ${wallet.address}`);
        }

    } catch (error) {
        console.error('エラーが発生しました:', error);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('データベース切断エラー:', err.message);
            }
            console.log('処理が完了しました');
        });
    }
}

// プログラムを実行
main().catch(console.error);