import { FileSyncer } from "../lib/sync";

describe("FileSyncer - shouldIgnore", () => {
  // Helper to test shouldIgnore by accessing private method
  const testShouldIgnore = (
    patterns: string[],
    filePath: string,
    rootDir: string = "/test"
  ): boolean => {
    const syncer = new FileSyncer(rootDir);
    // Access private ignorePatterns property
    (syncer as any).ignorePatterns = patterns;
    // Access private shouldIgnore method
    return (syncer as any).shouldIgnore(`${rootDir}/${filePath}`);
  };

  describe("wildcard patterns", () => {
    test("* pattern ignores everything", () => {
      expect(testShouldIgnore(["*"], "file.txt")).toBe(true);
      expect(testShouldIgnore(["*"], "src/file.ts")).toBe(true);
      expect(testShouldIgnore(["*"], "deeply/nested/path/file.js")).toBe(true);
    });

    test("*.log pattern ignores log files anywhere", () => {
      expect(testShouldIgnore(["*.log"], "app.log")).toBe(true);
      expect(testShouldIgnore(["*.log"], "error.log")).toBe(true);
      expect(testShouldIgnore(["*.log"], "app.txt")).toBe(false);
      expect(testShouldIgnore(["*.log"], "src/app.log")).toBe(true); // Wildcard matches anywhere
    });

    test("*.pyc pattern ignores Python compiled files", () => {
      expect(testShouldIgnore(["*.pyc"], "module.pyc")).toBe(true);
      expect(testShouldIgnore(["*.pyc"], "test.pyc")).toBe(true);
      expect(testShouldIgnore(["*.pyc"], "module.py")).toBe(false);
    });
  });

  describe("glob patterns with **/", () => {
    test("**/node_modules/ ignores paths containing node_modules/", () => {
      // Pattern slices to "node_modules/" and uses .includes()
      // Note: path.relative removes trailing slashes, so "node_modules/" becomes "node_modules"
      // The pattern matches paths that contain "node_modules/" as a directory component
      expect(
        testShouldIgnore(["**/node_modules/"], "node_modules/package.json")
      ).toBe(true);
      expect(
        testShouldIgnore(["**/node_modules/"], "src/node_modules/lib.js")
      ).toBe(true);
      expect(
        testShouldIgnore(["**/node_modules/"], "deep/nested/node_modules/pkg/index.js")
      ).toBe(true);
      expect(testShouldIgnore(["**/node_modules/"], "node_modules")).toBe(
        false
      ); // Doesn't contain "node_modules/" with slash
      expect(
        testShouldIgnore(["**/node_modules/"], "node_modules_backup/file.js")
      ).toBe(false);
    });

    test("**/__pycache__/ ignores paths containing __pycache__/", () => {
      expect(testShouldIgnore(["**/__pycache__/"], "__pycache__/module.pyc")).toBe(true);
      expect(testShouldIgnore(["**/__pycache__/"], "src/__pycache__/test.pyc")).toBe(
        true
      );
      expect(testShouldIgnore(["**/__pycache__/"], "__pycache__")).toBe(false); // No slash
      expect(testShouldIgnore(["**/__pycache__/"], "__pycache__old/file.py")).toBe(
        false
      );
    });

    test("**/.git/ ignores paths containing .git/", () => {
      expect(testShouldIgnore(["**/.git/"], ".git/config")).toBe(true);
      expect(testShouldIgnore(["**/.git/"], "submodule/.git/HEAD")).toBe(true);
      expect(testShouldIgnore(["**/.git/"], ".git")).toBe(false); // No slash
      expect(testShouldIgnore(["**/.git/"], ".github/workflows/test.yml")).toBe(false);
    });

    test("**/*.pyc is checked as literal string *.pyc", () => {
      // Pattern **/*.pyc starts with **/ so it slices to *.pyc and uses .includes()
      // This checks for the LITERAL string "*.pyc" in the path, which is unusual
      expect(testShouldIgnore(["**/*.pyc"], "path/to/*.pyc")).toBe(true); // Contains literal "*.pyc"
      expect(testShouldIgnore(["**/*.pyc"], "module.pyc")).toBe(false); // Doesn't contain "*.pyc"
      expect(testShouldIgnore(["**/*.pyc"], "src/module.pyc")).toBe(false);
      // To match .pyc files anywhere, use just *.pyc without **/ prefix
      expect(testShouldIgnore(["*.pyc"], "module.pyc")).toBe(true);
      expect(testShouldIgnore(["*.pyc"], "src/module.pyc")).toBe(true);
    });
  });

  describe("directory patterns with /**", () => {
    test("dist/** ignores everything starting with dist", () => {
      // Pattern dist/** checks startsWith("dist"), which also matches "distribution"
      expect(testShouldIgnore(["dist/**"], "dist")).toBe(true);
      expect(testShouldIgnore(["dist/**"], "dist/file.js")).toBe(true);
      expect(testShouldIgnore(["dist/**"], "dist/nested/file.js")).toBe(true);
      expect(testShouldIgnore(["dist/**"], "distribution/file.js")).toBe(
        true
      ); // Also matches because startsWith("dist")
      expect(testShouldIgnore(["dist/**"], "src/dist/file.js")).toBe(false);
    });

    test("build/** ignores build directory contents", () => {
      expect(testShouldIgnore(["build/**"], "build")).toBe(true);
      expect(testShouldIgnore(["build/**"], "build/output.js")).toBe(true);
      expect(testShouldIgnore(["build/**"], "src/build")).toBe(false);
    });

    test(".venv/** ignores virtual environment", () => {
      expect(testShouldIgnore([".venv/**"], ".venv")).toBe(true);
      expect(testShouldIgnore([".venv/**"], ".venv/bin/python")).toBe(true);
      expect(testShouldIgnore([".venv/**"], "venv")).toBe(false);
    });
  });

  describe("exact file matches", () => {
    test("ignores exact filename in root", () => {
      expect(testShouldIgnore([".gitignore"], ".gitignore")).toBe(true);
      expect(testShouldIgnore([".gitignore"], "src/.gitignore")).toBe(false);
    });

    test("ignores README.md in root only", () => {
      expect(testShouldIgnore(["README.md"], "README.md")).toBe(true);
      expect(testShouldIgnore(["README.md"], "docs/README.md")).toBe(false);
    });

    test("ignores .DS_Store in root only", () => {
      expect(testShouldIgnore([".DS_Store"], ".DS_Store")).toBe(true);
      expect(testShouldIgnore([".DS_Store"], "folder/.DS_Store")).toBe(false);
    });
  });

  describe("path prefix matches", () => {
    test("src pattern (no trailing slash) matches src prefix", () => {
      // Pattern "src" matches via relativePath === "src" OR startsWith("src/")
      expect(testShouldIgnore(["src"], "src")).toBe(true);
      expect(testShouldIgnore(["src"], "src/index.ts")).toBe(true);
      expect(testShouldIgnore(["src"], "src/components/Button.tsx")).toBe(
        true
      );
      expect(testShouldIgnore(["src"], "source/file.ts")).toBe(false);
    });

    test("examples pattern ignores examples and contents", () => {
      expect(testShouldIgnore(["examples"], "examples")).toBe(true);
      expect(testShouldIgnore(["examples"], "examples/hello.ts")).toBe(true);
      expect(testShouldIgnore(["examples"], "examples/subdir/file.ts")).toBe(true);
      expect(testShouldIgnore(["examples"], "example/hello.ts")).toBe(false);
    });

    test("tests/fixtures pattern ignores test fixtures", () => {
      expect(
        testShouldIgnore(["tests/fixtures"], "tests/fixtures")
      ).toBe(true);
      expect(
        testShouldIgnore(["tests/fixtures"], "tests/fixtures/data.json")
      ).toBe(true);
      expect(
        testShouldIgnore(["tests/fixtures"], "tests/fixtures/subdir/file.txt")
      ).toBe(true);
      expect(testShouldIgnore(["tests/fixtures"], "tests/utils.ts")).toBe(
        false
      );
    });

    test("patterns without trailing slash", () => {
      // Pattern "src" matches exactly "src" or paths starting with "src/"
      expect(testShouldIgnore(["src"], "src")).toBe(true);
      expect(testShouldIgnore(["src"], "src/index.ts")).toBe(true);
      expect(testShouldIgnore(["src"], "source")).toBe(false);
    });
  });

  describe("multiple patterns", () => {
    test("applies all patterns in order", () => {
      const patterns = ["*.log", "dist/**", "**/node_modules/"];

      expect(testShouldIgnore(patterns, "app.log")).toBe(true);
      expect(testShouldIgnore(patterns, "dist/bundle.js")).toBe(true);
      expect(testShouldIgnore(patterns, "node_modules/lib/index.js")).toBe(true); // Contains node_modules/
      expect(testShouldIgnore(patterns, "src/index.ts")).toBe(false);
    });

    test("stops at first matching pattern", () => {
      const patterns = ["*", "src/**"]; // * will match everything first
      expect(testShouldIgnore(patterns, "anything.txt")).toBe(true);
      expect(testShouldIgnore(patterns, "src/file.ts")).toBe(true);
    });
  });

  describe("edge cases", () => {
    test("empty patterns array ignores nothing", () => {
      expect(testShouldIgnore([], "file.txt")).toBe(false);
      expect(testShouldIgnore([], "src/index.ts")).toBe(false);
    });

    test("handles paths with special characters", () => {
      expect(testShouldIgnore(["*.test.ts"], "app.test.ts")).toBe(true);
      expect(testShouldIgnore(["file-name.txt"], "file-name.txt")).toBe(true);
      expect(testShouldIgnore(["my_file.py"], "my_file.py")).toBe(true);
    });

    test("handles deeply nested paths", () => {
      expect(
        testShouldIgnore(
          ["**/temp/"],
          "very/deeply/nested/path/to/temp/file.txt"
        )
      ).toBe(true); // Contains temp/ with file inside
      expect(
        testShouldIgnore(
          ["deep/**"],
          "deep/very/long/path/structure/file.txt"
        )
      ).toBe(true);
    });

    test("handles root-level files", () => {
      expect(testShouldIgnore(["package.json"], "package.json")).toBe(true);
      expect(testShouldIgnore(["*.json"], "tsconfig.json")).toBe(true);
    });

    test("case sensitive matching", () => {
      expect(testShouldIgnore(["README.md"], "readme.md")).toBe(false);
      expect(testShouldIgnore(["src/"], "SRC")).toBe(false);
    });
  });

  describe("common ignore patterns", () => {
    const commonPatterns = [
      ".git",
      ".vscode",
      "node_modules",
      "**/__pycache__/",
      "**/.pytest_cache/",
      "*.pyc",
      ".DS_Store",
      "dist/**",
      "build/**",
    ];

    test("ignores version control directories", () => {
      expect(testShouldIgnore(commonPatterns, ".git")).toBe(true);
      expect(testShouldIgnore(commonPatterns, ".vscode")).toBe(true);
    });

    test("ignores dependency directories", () => {
      expect(testShouldIgnore(commonPatterns, "node_modules")).toBe(true);
    });

    test("ignores Python artifacts", () => {
      expect(testShouldIgnore(commonPatterns, "src/__pycache__/module.pyc")).toBe(true); // Contains __pycache__/
      expect(testShouldIgnore(commonPatterns, "test.pyc")).toBe(true);
      expect(testShouldIgnore(commonPatterns, "tests/.pytest_cache/results.xml")).toBe(
        true
      ); // Contains .pytest_cache/
    });

    test("ignores build outputs", () => {
      expect(testShouldIgnore(commonPatterns, "dist")).toBe(true);
      expect(testShouldIgnore(commonPatterns, "build")).toBe(true);
    });

    test("allows source files", () => {
      expect(testShouldIgnore(commonPatterns, "src/index.ts")).toBe(false);
      expect(testShouldIgnore(commonPatterns, "lib/util.js")).toBe(false);
      expect(testShouldIgnore(commonPatterns, "README.md")).toBe(false);
    });
  });
});

describe("FileSyncer - shouldInclude", () => {
  // Helper to test shouldInclude by accessing private method
  const testShouldInclude = (
    patterns: string[],
    filePath: string,
    rootDir: string = "/test"
  ): boolean => {
    const syncer = new FileSyncer(rootDir);
    // Access private includePatterns property
    (syncer as any).includePatterns = patterns;
    // Access private shouldInclude method
    return (syncer as any).shouldInclude(`${rootDir}/${filePath}`);
  };

  describe("empty include patterns", () => {
    test("includes everything when no patterns specified", () => {
      expect(testShouldInclude([], "file.txt")).toBe(true);
      expect(testShouldInclude([], "src/index.ts")).toBe(true);
      expect(testShouldInclude([], "deeply/nested/file.js")).toBe(true);
    });
  });

  describe("specific file patterns", () => {
    test("includes only matching files", () => {
      expect(testShouldInclude(["src/index.ts"], "src/index.ts")).toBe(true);
      expect(testShouldInclude(["src/index.ts"], "src/other.ts")).toBe(false);
      expect(testShouldInclude(["src/index.ts"], "lib/index.ts")).toBe(false);
    });

    test("includes directory contents", () => {
      // Patterns without trailing slashes match directory contents via startsWith(pattern + "/")
      expect(testShouldInclude(["src"], "src/index.ts")).toBe(true);
      expect(testShouldInclude(["src"], "src/components/Button.tsx")).toBe(
        true
      );
      expect(testShouldInclude(["src"], "src")).toBe(true); // Exact match
      expect(testShouldInclude(["src"], "lib/util.ts")).toBe(false);
    });
  });

  describe("wildcard patterns", () => {
    test("*.ts uses wildcard regex matching", () => {
      // Wildcard becomes regex, matches anywhere
      expect(testShouldInclude(["*.ts"], "index.ts")).toBe(true);
      expect(testShouldInclude(["*.ts"], "util.ts")).toBe(true);
      expect(testShouldInclude(["*.ts"], "file.js")).toBe(false);
      expect(testShouldInclude(["*.ts"], "src/index.ts")).toBe(true); // Matches anywhere
    });

    test("src/*.ts includes TypeScript in src", () => {
      expect(testShouldInclude(["src/*.ts"], "src/index.ts")).toBe(true);
      expect(testShouldInclude(["src/*.ts"], "src/util.ts")).toBe(true);
      expect(testShouldInclude(["src/*.ts"], "src/index.js")).toBe(false);
      expect(testShouldInclude(["src/*.ts"], "lib/index.ts")).toBe(false);
    });
  });

  describe("multiple patterns", () => {
    test("includes files matching any pattern", () => {
      // Patterns without trailing slashes match directory contents via startsWith(pattern + "/")
      const patterns = ["src", "lib", "*.md"];

      expect(testShouldInclude(patterns, "src/index.ts")).toBe(true);
      expect(testShouldInclude(patterns, "lib/util.js")).toBe(true);
      expect(testShouldInclude(patterns, "README.md")).toBe(true);
      expect(testShouldInclude(patterns, "docs/README.md")).toBe(true); // *.md matches anywhere
      expect(testShouldInclude(patterns, "tests/test.ts")).toBe(false);
    });

    test("handles overlapping patterns", () => {
      const patterns = ["src/", "src/*.ts"];

      expect(testShouldInclude(patterns, "src/index.ts")).toBe(true);
      expect(testShouldInclude(patterns, "src/components/Button.tsx")).toBe(
        true
      );
    });
  });

  describe("edge cases", () => {
    test("handles paths with special characters", () => {
      expect(testShouldInclude(["*.test.ts"], "app.test.ts")).toBe(true);
      expect(testShouldInclude(["file-name.txt"], "file-name.txt")).toBe(true);
    });

    test("handles root-level patterns", () => {
      expect(testShouldInclude(["package.json"], "package.json")).toBe(true);
      expect(testShouldInclude(["package.json"], "src/package.json")).toBe(
        false
      );
    });

    test("case sensitive matching", () => {
      expect(testShouldInclude(["README.md"], "readme.md")).toBe(false);
      expect(testShouldInclude(["src/"], "SRC")).toBe(false);
    });
  });
});

describe("FileSyncer - ignore and include interaction", () => {
  test("both ignore and include work together", () => {
    const syncer = new FileSyncer("/test");
    (syncer as any).ignorePatterns = ["*.log", "dist/**"];
    // Use pattern without trailing slash to match directory contents
    (syncer as any).includePatterns = ["src"];

    const shouldIgnore = (path: string) =>
      (syncer as any).shouldIgnore(`/test/${path}`);
    const shouldInclude = (path: string) =>
      (syncer as any).shouldInclude(`/test/${path}`);

    // File in src, not ignored, should be included
    expect(shouldInclude("src/index.ts")).toBe(true);
    expect(shouldIgnore("src/index.ts")).toBe(false);

    // Log file in src, should be ignored despite being in src (*.log has wildcard)
    expect(shouldIgnore("src/app.log")).toBe(true);
    expect(shouldInclude("src/app.log")).toBe(true);

    // File in dist, should be ignored
    expect(shouldIgnore("dist/bundle.js")).toBe(true);

    // File outside src
    expect(shouldInclude("lib/util.ts")).toBe(false);
  });
});
