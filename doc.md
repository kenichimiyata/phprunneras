 
① php artisan batch:ReplaceAllCmrUrl
　 SS側DBに保存されている、CMSとSSのURLを対応させたレコードを洗い替えで最新化するバッチ。SiteMapも再生成する
② php artisan batch:DeleteRedisCmsCache
　 Redisに登録された就活ガイド関連のキャッシュを全削除する。
　 キャッシュはコンテンツの読み込み速度を向上させるために使用
　 対象となるキャッシュの種類は以下
　・記事詳細画面のHTML文字列
　・タグ記事画面のHTML文字列
　・ピックアップ記事表示用のJSONメタデータ
　・ガイドTop表示用のJSONメタデータ


