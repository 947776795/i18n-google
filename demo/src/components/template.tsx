import React, { useState, useEffect } from "react";
import { I18n } from "@utils";
/**
 * 🔍 AstTransformer 代码格式处理能力完整示范
 *
 * 此文件展示了 AstTransformer 能够处理和不能处理的所有代码格式
 *
 * 配置示例：
 * {
 *   startMarker: "~",
 *   endMarker: "~",
 *   include: ["ts", "tsx", "js", "jsx"],
 *   rootDir: "./src"
 * }
 */

// ==================== 类型定义（不会被处理） ====================
interface UserProps {
  name: string;
  age: number;
  email: string;
  role: "admin" | "user";
}

type MessageType = {
  content: "message_content";
  timestamp: Date;
};

// ==================== 支持的格式：字符串字面量 + 标记符号 ====================

// ✅ 基本字符串字面量
const welcomeMessage = I18n.t("e521ab3c");
const errorMessage = I18n.t("0a678cd8");
const successMessage = I18n.t("9bad9f33");

// ✅ 在对象中的字符串
const messages = {
  greeting: I18n.t("31d42821"),
  farewell: I18n.t("4c686ee4"),
  loading: I18n.t("50036f4a"),
};

// ✅ 在数组中的字符串
const notifications = [
  I18n.t("a25027dc"),
  I18n.t("e277185b"),
  I18n.t("52cf5a5b"),
];

// ✅ 在函数调用中的字符串
console.log(I18n.t("2a11f410"));
alert(I18n.t("dbae65dc"));

// ✅ 条件表达式中的字符串
const getStatusMessage = (isOnline: boolean) =>
  isOnline ? I18n.t("e0a9ad9a") : I18n.t("13cdae2e");

// ==================== 支持的格式：模板字面量 + 标记符号 + 变量 ====================

// ✅ 单个变量的模板字面量
const createGreeting = (name: string) =>
  I18n.t("618933b4", {
    var0: name,
  });

// ✅ 多个变量的模板字面量
const createNotification = (user: string, count: number) =>
  I18n.t("95f83529", {
    var0: user,
    var1: count,
  });

// ✅ 复杂表达式的模板字面量
const createUserInfo = (user: UserProps) =>
  I18n.t("c7a8c271", {
    var0: user.name,
    var1: user.age,
    var2: user.role,
  });

// ✅ 在函数中使用
const logUserAction = (action: string, user: string) => {
  console.log(
    I18n.t("d3c4705a", {
      var0: user,
      var1: action,
    })
  );
};

// ==================== 不支持的格式：无标记的字符串 ====================

// ❌ 普通字符串字面量（无标记符号）
const plainMessage = "This is a plain message";
const anotherPlain = "No markers here";

// ❌ 普通模板字面量（无标记符号）
const plainTemplate = (name: string) => `Hello ${name} without markers`;

// ❌ 动态生成的字符串
const dynamicMarker = "~" + "Dynamic" + "~";
const computedKey = ["~" + "computed" + "~"][0];

// ❌ 正则表达式
const markerRegex = /~[^~]+~/g;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ==================== React 组件示例 ====================

interface ComponentProps {
  user: UserProps;
  itemCount: number;
  score: number;
  isLoading: boolean;
}

export const AstTransformerDemo: React.FC<ComponentProps> = ({
  user,
  itemCount,
  score,
  isLoading,
}) => {
  const [status, setStatus] = useState<string>("");

  // ✅ 在 useEffect 中的字符串
  useEffect(() => {
    console.log(I18n.t("f36171f4"));
    setStatus(I18n.t("fc22c863"));
  }, []);

  // ✅ 事件处理函数中的字符串
  const handleClick = () => {
    alert(I18n.t("07ca0b53"));
    console.log(I18n.t("2434e55c"));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    console.log(I18n.t("e15c9898"));
  };

  // ==================== JSX 返回：支持的格式 ====================

  return (
    <div className="demo-container">
      {/* ✅ 纯英文 JSX 文本节点 - 会被自动转换 */}
      <h1>{I18n.t("c24a1a7c")}</h1>
      {/* ✅ 包含英文的 JSX 文本 - 会被转换 */}
      <h2>{I18n.t("2e8288ae")}</h2>
      {/* ✅ JSX 混合内容：文本 + 表达式，包含英文 - 会被转换为占位符 */}
      <p>
        {I18n.t("e85221ab", {
          var0: user.name,
        })}
      </p>
      <div>
        {I18n.t("1e7216ec", {
          var0: itemCount,
        })}
      </div>
      <span>
        {I18n.t("2c834682", {
          var0: score,
        })}
      </span>
      {/* ✅ 复杂的混合内容 - 多个变量 */}
      <section>
        {I18n.t("f04dfe38", {
          var0: user.name,
          var1: user.age,
          var2: itemCount,
        })}
      </section>
      {/* ✅ 中英文混合内容 - 包含英文字符，会被处理 */}
      <div>
        {I18n.t("13d742e6", {
          var0: score,
        })}
      </div>
      <p>
        {I18n.t("c27463d4", {
          var0: user.name,
          var1: user.email,
        })}
      </p>
      {/* ✅ JSX 属性中的标记字符串 - 会被转换 */}
      <button
        title={I18n.t("7dbf47cc")}
        aria-label={I18n.t("5c9fb14c")}
        onClick={handleClick}
      >
        {I18n.t("612c9b67")}
      </button>
      <input
        type="text"
        placeholder={I18n.t("f3248950")}
        aria-describedby="help-text"
      />
      <img
        src="/logo.png"
        alt={I18n.t("51549fd6")}
        title={I18n.t("3e2580a6")}
      />
      {/* ✅ 条件渲染中的文本 */}
      {isLoading ? (
        <div>{I18n.t("6cff86cc")}</div>
      ) : (
        <div>{I18n.t("83cffdce")}</div>
      )}
      {/* ✅ 在 JSX 表达式中的标记字符串 */}
      <p>{I18n.t("d66249b2")}</p>
      <div>
        {I18n.t("1bd2b0f4", {
          var0: user.name,
        })}
      </div>
      {/* ✅ 列表渲染中的文本 */}
      <ul>
        <li>{I18n.t("6fac04b2")}</li>
        <li>{I18n.t("582923c0")}</li>
        <li>{I18n.t("f100a90c")}</li>
      </ul>
      {/* ✅ 表单元素 */}
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">{I18n.t("a18ee0ae")}</label>
        <input
          id="email"
          type="email"
          placeholder={I18n.t("d0f75ee1")}
          required
        />

        <label htmlFor="message">{I18n.t("d7ce1b17")}</label>
        <textarea id="message" placeholder={I18n.t("4d10146f")} rows={4} />

        <button type="submit">{I18n.t("945c8eb7")}</button>
      </form>
      {/* ==================== JSX：不支持的格式 ==================== */}
      {/* ❌ 纯中文文本 - 无英文字符，不会被转换 */}
      <h3>你好世界</h3>
      <p>欢迎使用我们的应用程序</p>
      <div>这是纯中文内容</div>
      {/* ❌ 纯中文混合内容 - 无英文字符，不会被转换 */}
      <div>你好 {user.name}，欢迎回来</div>
      <p>
        用户 {user.name} 有 {itemCount} 条消息
      </p>
      {/* ❌ 纯数字文本 - 无英文字符，不会被转换 */}
      <span>123456</span>
      <div>2024年1月1日</div>
      {/* ❌ 纯符号文本 - 无英文字符，不会被转换 */}
      <div>！@#￥~…※</div>
      <span>★☆♠♣♥♦</span>
      {/* ❌ 空白文本 - 会被跳过 */}
      <div> </div>
      <p></p>
      {/* ❌ 已经是 I18n 调用的内容 - 不会重复处理 */}
      <div>{I18n.t("existing_key")}</div>
      <p>{I18n.t("another_key", { var0: user.name })}</p>
      {/* ==================== 特殊情况展示 ==================== */}
      {/* ✅ 嵌套结构中的文本 */}
      <div>
        <header>
          <nav>
            <a href="/home">{I18n.t("be4fe53b")}</a>
            <a href="/about">{I18n.t("59b528d3")}</a>
            <a href="/contact">{I18n.t("d33f9343")}</a>
          </nav>
        </header>

        <main>
          <article>
            <h2>{I18n.t("c84bcaf9")}</h2>
            <p>
              {I18n.t("e90f7665", {
                var0: user.name,
              })}
            </p>
            <footer>
              {I18n.t("45f5ecd5", {
                var0: user.name,
              })}
            </footer>
          </article>
        </main>
      </div>
      {/* ✅ 表格中的文本 */}
      <table>
        <thead>
          <tr>
            <th>{I18n.t("669fbd4b")}</th>
            <th>{I18n.t("e14cad00")}</th>
            <th>{I18n.t("dca37fbd")}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{user.name}</td>
            <td>{user.email}</td>
            <td>{I18n.t("4049e43c")}</td>
          </tr>
        </tbody>
      </table>
      {/* ✅ 复杂的嵌套混合内容 */}
      <div>
        <p>
          {I18n.t("ef0d29bc", {
            var0: user.name,
            var1: itemCount,
            var2: " ",
            var3: score,
          })}
        </p>
      </div>
      {/* ==================== 边界情况测试 ==================== */}
      {/* ✅ 包含特殊字符的英文文本 */}
      <div>{I18n.t("6fdb23ef")}</div>
      <p>{I18n.t("ff6731e7")}</p>
      {/* ✅ 包含HTML实体的文本 */}
      <div>{I18n.t("8d36e326")}</div>
      <p>{I18n.t("c42f8ec9")}</p>
      {/* ✅ 长文本内容 */}
      <p>
        {I18n.t("63ce8664", {
          var0: " ",
          var1: user.name,
        })}
      </p>
      {/* ✅ 包含换行的文本 */}
      <pre>
        {I18n.t("84d84f3a", {
          var0: user.name,
        })}
      </pre>
    </div>
  );
};

// ==================== 导出的辅助函数 ====================

// ✅ 返回标记字符串的函数
export const getWelcomeMessage = (name: string): string => {
  return I18n.t("6da98838", {
    var0: name,
  });
};

// ✅ 处理错误消息的函数
export const handleError = (error: string): void => {
  console.error(
    I18n.t("d5d5c0c5", {
      var0: error,
    })
  );
  alert(
    I18n.t("ce032e1c", {
      var0: error,
    })
  );
};

// ✅ 格式化用户信息的函数
export const formatUserInfo = (user: UserProps): string => {
  return I18n.t("81e8598f", {
    var0: user.name,
    var1: user.email,
    var2: user.age,
  });
};

// ❌ 返回普通字符串的函数（不会被处理）
export const getPlainMessage = (): string => {
  return "This is a plain message without markers";
};

// ==================== 类和方法示例 ====================

export class MessageHandler {
  private prefix = I18n.t("5e5850bb"); // ✅ 会被处理
  private plainPrefix = "Debug:"; // ❌ 不会被处理

  // ✅ 方法中的标记字符串
  public showMessage(text: string): void {
    console.log(
      I18n.t("9af7b388", {
        var0: text,
      })
    );
  }

  // ✅ 返回标记字符串的方法
  public getFormattedMessage(user: string, action: string): string {
    return I18n.t("148a2154", {
      var0: user,
      var1: action,
    });
  }

  // ❌ 私有方法中的普通字符串
  private logDebug(message: string): void {
    console.log(`Debug: ${message}`);
  }
}

// ==================== 异步函数示例 ====================

// ✅ 异步函数中的标记字符串
export const fetchUserData = async (userId: string): Promise<string> => {
  try {
    console.log(
      I18n.t("e900cd7a", {
        var0: userId,
      })
    );
    // 模拟 API 调用
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return I18n.t("4958cbcf", {
      var0: userId,
    });
  } catch (error) {
    console.error(
      I18n.t("c931fdd3", {
        var0: userId,
      })
    );
    throw new Error(
      I18n.t("9b42e13c", {
        var0: error,
      })
    );
  }
};

// ==================== 默认导出 ====================

export default AstTransformerDemo;

/*
 * ==================== 转换结果预期 ====================
 *
 * 经过 AstTransformer 处理后，此文件将：
 *
 * 1. 自动添加 I18n 导入：
 *    import { I18n } from "@utils";
 *
 * 2. 标记字符串转换示例：
 *    "~Welcome to our application~" → I18n.t("a1b2c3d4")
 *    `~Hello ${name}!~` → I18n.t("e5f6g7h8", { var0: name })
 *
 * 3. JSX 文本转换示例：
 *    <h1>Welcome to AstTransformer Demo</h1>
 *    → <h1>{I18n.t("f9g0h1i2")}</h1>
 *
 * 4. JSX 混合内容转换示例：
 *    <p>Hello {user.name}, welcome back!</p>
 *    → <p>{I18n.t("j3k4l5m6", { var0: user.name })}</p>
 *
 * 5. 生成的翻译文件内容示例：
 *    {
 *      "a1b2c3d4": "Welcome to our application",
 *      "e5f6g7h8": "Hello ~{var0}!",
 *      "f9g0h1i2": "Welcome to AstTransformer Demo",
 *      "j3k4l5m6": "Hello ~{var0}, welcome back!",
 *      ...
 *    }
 *
 * 6. 不会被处理的内容：
 *    - 纯中文文本保持原样
 *    - 类型定义中的标记保持原样
 *    - 普通字符串（无标记）保持原样
 *    - 注释内容保持原样
 *    - 已存在的 I18n.t() 调用保持原样
 */
