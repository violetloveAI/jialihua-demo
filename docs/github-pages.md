# GitHub Demo 部署

目标仓库为 `violetloveAI/jialihua-demo`，演示地址为 `https://violetloveAI.github.io/jialihua-demo/`。原本的 `http://localhost:4174/` 继续使用本地 Node 服务；GitHub 版本单独构建到 `dist-pages/`，互不覆盖。

## 演示范围

GitHub Pages 是静态网页托管。此构建保留登录与身份选择、引导、9 张演示截图、预设解读、普通话和河南话录音、字号与语速、历史记录、图片放大、长图导出，以及 9 个截图案例和 3 个写话示例的 24 条双语视频。

所有示例均明确采用预先准备的内容。这里没有运行在线模型：配音直接读取已准备的 MP3 和时间轴，不会请求本地 `/api` 或消耗模型额度。历史记录保存在当前浏览器里，不跨设备同步。

自由截图识别和修改文案后的新视频合成需要 Node 后端，因此静态版隐藏真实相册上传入口，不提供这些在线功能。子女仍可修改文字并在浏览器保存长图；视频使用与内容完全匹配的预制文件。缺少匹配视频或配音时显示提示，不用其他内容冒充。

## 本地检查

需要 Node.js 24 和 npm。已准备的演示媒体播放与静态构建不需要 API Key、FFmpeg 或 Python。

```sh
npm ci
npm test
npm run build:pages
npm run check:pages
npm run preview:pages
```

最后打开 `http://127.0.0.1:4176/jialihua-demo/`。这只是本机预览，不是公开链接。预览服务不代理本地 API，用于核查没有后端时的完整演示。

已知目标仓库后，将 `JIALIHUA_PAGES_BASE` 设为 `/仓库名/`，再构建和预览。部署到 `<用户名>.github.io` 同名仓库时设为 `/`。正式网址通常为 `https://<用户名>.github.io/<仓库名>/`。若以后使用自定义域名，需同步调整 base。

`check:pages` 检查预制文本与音频时间轴、视频清单匹配、必需素材、文件体积及疑似密钥，报告写在 `.release/readiness.json`。文案、教程或配图调整后重新准备对应音视频并重新检查，避免文字变了、媒体仍是旧版。

## 独立仓库候选包

当前 Git 根目录还包含其他项目，不应把父目录整体上传。

```sh
npm run package:release
```

该命令生成 `.release/repository/`，只复制本应用的源代码、构建配置、测试和需要的演示素材。`.env.local`、`node_modules`、本机数据、无关项目和临时图片不在复制清单内。`.env.example` 只含空配置项。源代码内的服务端也不进入最终的静态发布目录 `dist-pages/`。

候选包不会自动追踪后续本地修改。发布前先完成本地功能验收，再重新运行测试、构建、检查和打包。密钥只能放在本地服务或未来的后端环境中，不能添加到 `VITE_*` 前端变量。

## 发布与更新

1. 确定目标 GitHub 仓库，将通过验收的独立候选包作为该仓库根目录上传。
2. 在仓库 Settings → Pages 中选择 GitHub Actions。GitHub Free 通常使用公开仓库；私有仓库需账户方案支持 Pages。发布的网站本身应按公开内容准备。
3. `.github/workflows/pages.yml` 仅接受手动运行，没有提交自动部署。默认 `publish=false` 只做检查；明确准备上线后再以 `publish=true` 运行。
4. 工作流在测试和素材检查全部通过后上传静态构建并发布，显示最终 Pages 链接。
5. 在真实公开地址重新验收老人端、子女端、双语播放、长图和视频下载，再交付链接。

静态演示播放不消耗模型额度。发布状态可在仓库的 Actions 和 Settings → Pages 中查看。

依据：[GitHub Pages 说明](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)、[GitHub Pages 限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)、[Vite 静态部署说明](https://vite.dev/guide/static-deploy.html)。
