#!/bin/bash

# npm发包脚本
# 功能：
# 1. 删除dist文件夹
# 2. 修改版本号
# 3. 将修改提交到远端
# 4. npm发布

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的日志
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否在git仓库中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    log_error "当前目录不是git仓库"
    exit 1
fi

# 检查工作区是否干净
if ! git diff-index --quiet HEAD --; then
    log_error "工作区有未提交的更改，请先提交或暂存"
    exit 1
fi

# 确保在main分支上
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    log_warning "当前分支是 $CURRENT_BRANCH，建议在main分支发布"
    read -p "是否继续？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "取消发布"
        exit 0
    fi
fi

# 步骤1: 删除dist文件夹
log_info "步骤1: 删除dist文件夹..."
if [ -d "dist" ]; then
    rm -rf dist
    log_success "dist文件夹已删除"
else
    log_warning "dist文件夹不存在，跳过删除"
fi

# 步骤2: 获取当前版本并选择新版本
log_info "步骤2: 版本管理..."
CURRENT_VERSION=$(node -p "require('./package.json').version")
log_info "当前版本: $CURRENT_VERSION"

echo "请选择版本更新类型:"
echo "1) patch (补丁版本，如 1.0.0 -> 1.0.1)"
echo "2) minor (次要版本，如 1.0.0 -> 1.1.0)"
echo "3) major (主要版本，如 1.0.0 -> 2.0.0)"
echo "4) 手动输入版本号"

read -p "请选择 (1-4): " choice

case $choice in
    1)
        VERSION_TYPE="patch"
        ;;
    2)
        VERSION_TYPE="minor"
        ;;
    3)
        VERSION_TYPE="major"
        ;;
    4)
        read -p "请输入新版本号: " NEW_VERSION
        if [[ ! $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            log_error "版本号格式不正确，应为 x.y.z 格式"
            exit 1
        fi
        ;;
    *)
        log_error "无效选择"
        exit 1
        ;;
esac

# 更新版本号
if [ -n "$VERSION_TYPE" ]; then
    npm version $VERSION_TYPE --no-git-tag-version
    NEW_VERSION=$(node -p "require('./package.json').version")
else
    npm version $NEW_VERSION --no-git-tag-version
fi

log_success "版本已更新为: $NEW_VERSION"

# 构建项目
log_info "构建项目..."
npm run build

if [ ! -d "dist" ]; then
    log_error "构建失败，dist文件夹未生成"
    exit 1
fi

log_success "项目构建完成"

# 步骤3: 提交到git并推送到远端
log_info "步骤3: 提交到git..."
git add package.json dist/
git commit -m "chore: bump version to $NEW_VERSION"

# 创建git标签
git tag "v$NEW_VERSION"

log_info "推送到远端..."
git push origin $CURRENT_BRANCH
git push origin "v$NEW_VERSION"

log_success "已推送到远端仓库"

# 步骤4: npm发布
log_info "步骤4: npm发布..."

# 检查npm登录状态
if ! npm whoami > /dev/null 2>&1; then
    log_warning "未登录npm，请先登录"
    npm login
fi

log_info "开始发布到npm..."
npm publish

if [ $? -eq 0 ]; then
    log_success "🎉 版本 $NEW_VERSION 发布成功！"
    log_info "可以通过以下命令安装: npm install i18n-google@$NEW_VERSION"
else
    log_error "npm发布失败"
    exit 1
fi

echo
log_success "发布流程完成！" 