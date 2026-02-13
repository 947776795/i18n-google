#!/bin/bash
# src-v2 Code Review Agent Team - 初始化脚本
# 用途: 启动代码审查环境

echo "=== src-v2 代码审查 Agent Team ==="
echo "当前工作目录: $(pwd)"
echo ""

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
    echo "错误: 请在项目根目录运行此脚本"
    exit 1
fi

# 检查src-v2目录是否存在
if [ ! -d "src-v2" ]; then
    echo "错误: src-v2目录不存在"
    exit 1
fi

echo "✓ 项目结构检查完成"
echo ""

# 显示代码审查范围
echo "=== 代码审查范围 ==="
echo "目标目录: src-v2/"
echo "审查代理: 5个专门代理"
echo "  - 架构与SOLID审查代理"
echo "  - 安全与错误处理审查代理"
echo "  - 性能与优化审查代理"
echo "  - 测试覆盖率与质量审查代理"
echo "  - 文档与代码一致性审查代理"
echo ""

# 显示当前进度
if [ -f "claude-progress.txt" ]; then
    echo "=== 当前进度 ==="
    tail -20 claude-progress.txt
    echo ""
fi

# 显示待完成特性
if [ -f "feature-list.json" ]; then
    echo "=== 待审查模块 ==="
    node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('feature-list.json','utf8')); const pending=data.features.filter(f=>!f.passes); console.log(\`总计: \${data.features.length} | 已完成: \${data.features.length-pending.length} | 待完成: \${pending.length}\`);"
    echo ""
fi

echo "=== 环境就绪 ==="
echo "使用Skill tool启动具体审查代理"
