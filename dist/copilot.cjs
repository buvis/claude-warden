#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/nodes/identity.js"(exports2) {
    "use strict";
    var ALIAS = /* @__PURE__ */ Symbol.for("yaml.alias");
    var DOC = /* @__PURE__ */ Symbol.for("yaml.document");
    var MAP = /* @__PURE__ */ Symbol.for("yaml.map");
    var PAIR = /* @__PURE__ */ Symbol.for("yaml.pair");
    var SCALAR = /* @__PURE__ */ Symbol.for("yaml.scalar");
    var SEQ = /* @__PURE__ */ Symbol.for("yaml.seq");
    var NODE_TYPE = /* @__PURE__ */ Symbol.for("yaml.node.type");
    var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
    var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
    exports2.ALIAS = ALIAS;
    exports2.DOC = DOC;
    exports2.MAP = MAP;
    exports2.NODE_TYPE = NODE_TYPE;
    exports2.PAIR = PAIR;
    exports2.SCALAR = SCALAR;
    exports2.SEQ = SEQ;
    exports2.hasAnchor = hasAnchor;
    exports2.isAlias = isAlias;
    exports2.isCollection = isCollection;
    exports2.isDocument = isDocument;
    exports2.isMap = isMap;
    exports2.isNode = isNode;
    exports2.isPair = isPair;
    exports2.isScalar = isScalar;
    exports2.isSeq = isSeq;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/visit.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node, visitor, path) {
      const ctrl = callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visit_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = visit_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path) {
      const ctrl = await callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visitAsync_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path) {
      if (typeof visitor === "function")
        return visitor(key, node, path);
      if (identity.isMap(node))
        return visitor.Map?.(key, node, path);
      if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path);
      if (identity.isPair(node))
        return visitor.Pair?.(key, node, path);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path);
      if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path);
      return void 0;
    }
    function replaceNode(key, path, node) {
      const parent = path[path.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports2.visit = visit;
    exports2.visitAsync = visitAsync;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/doc/directives.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version] = parts;
            if (version === "1.1" || version === "1.2") {
              this.yaml.version = version;
              return true;
            } else {
              const isValid = /^\d+\.\d+$/.test(version);
              onError(6, `Unsupported YAML version ${version}`, isValid);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports2.Directives = Directives;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/doc/anchors.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name))
          return name;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports2.anchorIsValid = anchorIsValid;
    exports2.anchorNames = anchorNames;
    exports2.createNodeAnchors = createNodeAnchors;
    exports2.findNewAnchor = findNewAnchor;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/doc/applyReviver.js"(exports2) {
    "use strict";
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports2.applyReviver = applyReviver;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/nodes/toJS.js"(exports2) {
    "use strict";
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports2.toJS = toJS;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/nodes/Node.js"(exports2) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports2.NodeBase = NodeBase;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/nodes/Alias.js"(exports2) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const { anchors: anchors2, doc, maxAliasCount } = ctx;
        const source = this.resolve(doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        let data = anchors2.get(source);
        if (!data) {
          toJS.toJS(source, null, ctx);
          data = anchors2.get(source);
        }
        if (data?.res === void 0) {
          const msg = "This should not happen: Alias anchor was not resolved?";
          throw new ReferenceError(msg);
        }
        if (maxAliasCount >= 0) {
          data.count += 1;
          if (data.aliasCount === 0)
            data.aliasCount = getAliasCount(doc, source, anchors2);
          if (data.count * data.aliasCount > maxAliasCount) {
            const msg = "Excessive alias count indicates a resource exhaustion attack";
            throw new ReferenceError(msg);
          }
        }
        return data.res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports2.Alias = Alias;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/nodes/Scalar.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports2.Scalar = Scalar;
    exports2.isScalarValue = isScalarValue;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/doc/createNode.js"(exports2) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match = tags.filter((t) => t.tag === tagName);
        const tagObj = match.find((t) => !t.format) ?? match[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t) => t.identify?.(value) && !t.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value))
        value = value.contents;
      if (identity.isNode(value))
        return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node2 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports2.createNode = createNode;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/nodes/Collection.js"(exports2) {
    "use strict";
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path, value) {
      let v = value;
      for (let i = path.length - 1; i >= 0; --i) {
        const k = path[i];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy.schema = schema;
        copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path, value) {
        if (isEmptyPath(path))
          this.add(value);
        else {
          const [key, ...rest] = path;
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
          return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity.isPair(node))
            return false;
          const n = node.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        const [key, ...rest] = path;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports2.Collection = Collection;
    exports2.collectionFromPath = collectionFromPath;
    exports2.isEmptyPath = isEmptyPath;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/stringify/stringifyComment.js"(exports2) {
    "use strict";
    var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
    exports2.indentComment = indentComment;
    exports2.lineComment = lineComment;
    exports2.stringifyComment = stringifyComment;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/stringify/foldFlowLines.js"(exports2) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text.length <= endStep)
        return text;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text[i + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text[i += 1];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j])
                return text;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text;
      if (onFold)
        onFold();
      let res = text.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text.length;
        if (fold === 0)
          res = `
${indent}${text.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text[fold]}\\`;
          res += `
${indent}${text.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text[++i];
        } else {
          do {
            ch = text[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text[start];
        }
      }
      return end;
    }
    exports2.FOLD_BLOCK = FOLD_BLOCK;
    exports2.FOLD_FLOW = FOLD_FLOW;
    exports2.FOLD_QUOTED = FOLD_QUOTED;
    exports2.foldFlowLines = foldFlowLines;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/stringify/stringifyString.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
    function lineLengthOverLimit(str, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str = "";
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
          str += json.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i + 1]) {
            case "u":
              {
                str += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str += "\\0";
                    break;
                  case "0007":
                    str += "\\a";
                    break;
                  case "000b":
                    str += "\\v";
                    break;
                  case "001b":
                    str += "\\e";
                    break;
                  case "0085":
                    str += "\\N";
                    break;
                  case "00a0":
                    str += "\\_";
                    break;
                  case "2028":
                    str += "\\L";
                    break;
                  case "2029":
                    str += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str += "\\x" + code.substr(2);
                    else
                      str += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str += json.slice(start, i) + "\n\n";
                while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                  str += "\n";
                  i += 2;
                }
                str += indent;
                if (json[i + 2] === " ")
                  str += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str = start ? str + json.slice(start) : json;
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t);
        if (res === null)
          throw new Error(`Unsupported default string type ${t}`);
      }
      return res;
    }
    exports2.stringifyString = stringifyString;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/stringify/stringify.js"(exports2) {
    "use strict";
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
        inFlow,
        options: opt
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match = tags.filter((t) => t.tag === item.tag);
        if (match.length > 0)
          return match.find((t) => t.format === item.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter((t) => t.identify?.(obj));
        if (match.length > 1) {
          const testMatch = match.filter((t) => t.test);
          if (testMatch.length > 0)
            match = testMatch;
        }
        tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
      } else {
        obj = item;
        tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
      }
      if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str;
      return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
    }
    exports2.createStringifyContext = createStringifyContext;
    exports2.stringify = stringify;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/stringify/stringifyPair.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str === "" ? "?" : explicitKey ? `? ${str}` : str;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}
${indent}:`;
      } else {
        str = `${str}:`;
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str;
    }
    exports2.stringifyPair = stringifyPair;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/log.js"(exports2) {
    "use strict";
    var node_process = require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn2(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports2.debug = debug;
    exports2.warn = warn2;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      value = ctx && identity.isAlias(value) ? value.resolve(ctx.doc) : value;
      if (identity.isSeq(value))
        for (const it of value.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(value))
        for (const it of value)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, value);
    }
    function mergeValue(ctx, map, value) {
      const source = ctx && identity.isAlias(value) ? value.resolve(ctx.doc) : value;
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    exports2.addMergeToJSMap = addMergeToJSMap;
    exports2.isMergeKey = isMergeKey;
    exports2.merge = merge;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports2) {
    "use strict";
    var log = require_log();
    var merge = require_merge();
    var stringify = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports2.addPairToJSMap = addPairToJSMap;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/nodes/Pair.js"(exports2) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
          key = key.clone(schema);
        if (identity.isNode(value))
          value = value.clone(schema);
        return new _Pair(key, value);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports2.Pair = Pair;
    exports2.createPair = createPair;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/stringify/stringifyCollection.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify2(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str2 = stringify.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str2);
      }
      let str;
      if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
      } else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str = stringify.stringify(item, itemCtx, () => comment = null);
        if (i < items.length - 1)
          str += ",";
        if (comment)
          str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        if (!reqNewline && (lines.length > linesAtValue || str.includes("\n")))
          reqNewline = true;
        lines.push(str);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str = start;
          for (const line of lines)
            str += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports2.stringifyCollection = stringifyCollection;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/nodes/YAMLMap.js"(exports2) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key) {
      const k = identity.isScalar(key) ? key.value : key;
      for (const it of items) {
        if (identity.isPair(it)) {
          if (it.key === key || it.key === k)
            return it;
          if (identity.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
          if (typeof replacer === "function")
            value = replacer.call(obj, key, value);
          else if (Array.isArray(replacer) && !replacer.includes(key))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj)
            add(key, value);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports2.YAMLMap = YAMLMap;
    exports2.findPair = findPair;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/common/map.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
    };
    exports2.map = map;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/nodes/YAMLSeq.js"(exports2) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it of obj) {
            if (typeof replacer === "function") {
              const key = obj instanceof Set ? it : String(i++);
              it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports2.YAMLSeq = YAMLSeq;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/common/seq.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
    };
    exports2.seq = seq;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/common/string.js"(exports2) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports2.string = string;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/common/null.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports2.nullTag = nullTag;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/core/bool.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports2.boolTag = boolTag;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/stringify/stringifyNumber.js"(exports2) {
    "use strict";
    function stringifyNumber({ format, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num = typeof value === "number" ? value : Number(value);
      if (!isFinite(num))
        return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
      let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^\d/.test(n)) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports2.stringifyNumber = stringifyNumber;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/core/float.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf(".");
        if (dot !== -1 && str[str.length - 1] === "0")
          node.minFractionDigits = str.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports2.float = float;
    exports2.floatExp = floatExp;
    exports2.floatNaN = floatNaN;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/core/int.js"(exports2) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports2.int = int;
    exports2.intHex = intHex;
    exports2.intOct = intOct;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/core/schema.js"(exports2) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports2.schema = schema;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/json/schema.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str) => str,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str) => str === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str) => parseFloat(str),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports2.schema = schema;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports2) {
    "use strict";
    var node_buffer = require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str.length);
          for (let i = 0; i < str.length; ++i)
            buffer[i] = str.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str;
        if (typeof node_buffer.Buffer === "function") {
          str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str.substr(o, lineWidth);
          }
          str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
      }
    };
    exports2.binary = binary;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity.isPair(item))
            continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === "function")
            it = replacer.call(iterable, String(i++), it);
          let key, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports2.createPairs = createPairs;
    exports2.pairs = pairs;
    exports2.resolvePairs = resolvePairs;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx)
          return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports2.YAMLOMap = YAMLOMap;
    exports2.omap = omap;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports2.falseTag = falseTag;
    exports2.trueTag = trueTag;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str.replace(/_/g, "")),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
        const dot = str.indexOf(".");
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports2.float = float;
    exports2.floatExp = floatExp;
    exports2.floatNaN = floatNaN;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports2) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str, offset, radix, { intAsBigInt }) {
      const sign = str[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str = str.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str = `0b${str}`;
            break;
          case 8:
            str = `0o${str}`;
            break;
          case 16:
            str = `0x${str}`;
            break;
        }
        const n2 = BigInt(str);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports2.int = int;
    exports2.intBin = intBin;
    exports2.intHex = intHex;
    exports2.intOct = intOct;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === "function")
              value = replacer.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports2.YAMLSet = YAMLSet;
    exports2.set = set;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports2) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str, asBigInt) {
      const sign = str[0];
      const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
      const num = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
      return sign === "-" ? num(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num = (n) => n;
      if (typeof value === "bigint")
        num = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num(-1);
      }
      const _60 = num(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str) => parseSexagesimal(str, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str) {
        const match = str.match(timestamp.test);
        if (!match)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date -= 6e4 * d;
        }
        return new Date(date);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports2.floatTime = floatTime;
    exports2.intTime = intTime;
    exports2.timestamp = timestamp;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports2) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.trueTag,
      bool.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports2.schema = schema;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/tags.js"(exports2) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports2.coreKnownTags = coreKnownTags;
    exports2.getTags = getTags;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/schema/Schema.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports2.Schema = Schema;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/stringify/stringifyDocument.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports2.stringifyDocument = stringifyDocument;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/doc/Document.js"(exports2) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value = replacer.call({ "": value }, "", value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        if (Collection.isEmptyPath(path)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        if (Collection.isEmptyPath(path))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path) {
        if (Collection.isEmptyPath(path))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        if (Collection.isEmptyPath(path)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version, options = {}) {
        if (typeof version === "number")
          version = String(version);
        let opt;
        switch (version) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version;
            else
              this.directives = new directives.Directives({ version });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt)
          this.schema = new Schema.Schema(Object.assign(opt, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports2.Document = Document;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/errors.js"(exports2) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports2.YAMLError = YAMLError;
    exports2.YAMLParseError = YAMLParseError;
    exports2.YAMLWarning = YAMLWarning;
    exports2.prettifyError = prettifyError;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/resolve-props.js"(exports2) {
    "use strict";
    function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens) {
        if (reqSpace) {
          if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
            onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== "comment" && token.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
              tab = token;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
            if (found)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
            found = token;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports2.resolveProps = resolveProps;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/util-contains-newline.js"(exports2) {
    "use strict";
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st of key.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports2.containsNewline = containsNewline;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports2) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports2.flowIndentCheck = flowIndentCheck;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/util-map-includes.js"(exports2) {
    "use strict";
    var identity = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
      return items.some((pair) => isEqual(pair.key, search));
    }
    exports2.mapIncludes = mapIncludes;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/resolve-block-map.js"(exports2) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports2.resolveBlockMap = resolveBlockMap;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/resolve-block-seq.js"(exports2) {
    "use strict";
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports2.resolveBlockSeq = resolveBlockSeq;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/resolve-end.js"(exports2) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep = "";
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep + cb;
              sep = "";
              break;
            }
            case "newline":
              if (comment)
                sep += source;
              hasSpace = true;
              break;
            default:
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports2.resolveEnd = resolveEnd;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap = fc.start.source === "{";
      const fcName = isMap ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap && !sep && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap && !props.found && ctx.options.strict) {
              if (sep)
                for (const st of sep) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports2.resolveFlowCollection = resolveFlowCollection;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/compose-collection.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports2.composeCollection = composeCollection;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value = "";
      let sep = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep === " ")
            sep = "\n";
          else if (!prevMoreIndented && sep === "\n")
            sep = "\n\n";
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep === "\n")
            value += "\n";
          else
            sep = "\n";
        } else {
          value += sep + content;
          sep = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value += "\n" + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error === -1)
            error = offset + i;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token, "MISSING_CHAR", message);
            }
            length += token.source.length;
            comment = token.source.substring(1);
            break;
          case "error":
            onError(token, "UNEXPECTED_TOKEN", token.message);
            length += token.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, "UNEXPECTED_TOKEN", message);
            const ts = token.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports2.resolveBlockScalar = resolveBlockScalar;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return foldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return foldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function foldLines(source) {
      let first, line;
      try {
        first = new RegExp("(.*?)(?<![ 	])[ 	]*\r?\n", "sy");
        line = new RegExp("[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?\n", "sy");
      } catch {
        first = /(.*?)[ \t]*\r?\n/sy;
        line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
      }
      let match = first.exec(source);
      if (!match)
        return source;
      let res = match[1];
      let sep = " ";
      let pos = first.lastIndex;
      line.lastIndex = pos;
      while (match = line.exec(source)) {
        if (match[1] === "") {
          if (sep === "\n")
            res += sep;
          else
            sep = "\n";
        } else {
          res += sep + match[1];
          sep = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep + (match?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "\r" && source[i + 1] === "\n") {
            next = source[++i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = { x: 2, u: 4, U: 8 }[next];
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
          if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      if (isNaN(code)) {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
      return String.fromCodePoint(code);
    }
    exports2.resolveFlowScalar = resolveFlowScalar;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/compose-scalar.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports2.composeScalar = composeScalar;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports2) {
    "use strict";
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before[i];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before[++i];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports2.emptyScalarPosition = emptyScalarPosition;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/compose-node.js"(exports2) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          node = composeCollection.composeCollection(CN, ctx, token, props, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        default: {
          const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message);
          node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError);
          isSrcToken = false;
        }
      }
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        if (token.type === "scalar" && token.source === "")
          node.comment = comment;
        else
          node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports2.composeEmptyNode = composeEmptyNode;
    exports2.composeNode = composeNode;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/compose-doc.js"(exports2) {
    "use strict";
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports2.composeDoc = composeDoc;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/compose/composer.js"(exports2) {
    "use strict";
    var node_process = require("process");
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          Array.prototype.push.apply(doc.errors, this.errors);
          Array.prototype.push.apply(doc.warnings, this.warnings);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
          yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM)
          console.dir(token, { depth: null });
        switch (token.type) {
          case "directive":
            this.directives.add(token.source, (offset, message, warning) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token.source);
            break;
          case "error": {
            const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports2.Composer = Composer;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/parse/cst-scalar.js"(exports2) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token ? token.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token, source, "scalar");
      }
    }
    function setBlockScalarValue(token, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + "\n";
      if (token.type === "block-scalar") {
        const header = token.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = "indent" in token ? token.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token.type = type;
          token.source = source;
          break;
        case "block-scalar": {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === "block-scalar-header")
            oa -= token.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token.offset + source.length;
          const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token ? token.indent : -1;
          const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key of Object.keys(token))
            if (key !== "type" && key !== "offset")
              delete token[key];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports2.createScalarToken = createScalarToken;
    exports2.resolveAsScalar = resolveAsScalar;
    exports2.setScalarValue = setScalarValue;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/parse/cst-stringify.js"(exports2) {
    "use strict";
    var stringify = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token) {
      switch (token.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token.props)
            res += stringifyToken(tok);
          return res + token.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token.start.source;
          for (const item of token.items)
            res += stringifyItem(item);
          for (const st of token.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token);
          if (token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token.source;
          if ("end" in token && token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep)
        for (const st of sep)
          res += st.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports2.stringify = stringify;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/parse/cst-visit.js"(exports2) {
    "use strict";
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path) => {
      let item = cst;
      for (const [field, index] of path) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path) => {
      const parent = visit.itemAtPath(cst, path.slice(0, -1));
      const field = path[path.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path, item, visitor) {
      let ctrl = visitor(item, path);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item[field];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
            ctrl = ctrl(item, path);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
    }
    exports2.visit = visit;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/parse/cst.js"(exports2) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token) => !!token && "items" in token;
    var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
    function prettyToken(token) {
      switch (token) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports2.createScalarToken = cstScalar.createScalarToken;
    exports2.resolveAsScalar = cstScalar.resolveAsScalar;
    exports2.setScalarValue = cstScalar.setScalarValue;
    exports2.stringify = cstStringify.stringify;
    exports2.visit = cstVisit.visit;
    exports2.BOM = BOM;
    exports2.DOCUMENT = DOCUMENT;
    exports2.FLOW_END = FLOW_END;
    exports2.SCALAR = SCALAR;
    exports2.isCollection = isCollection;
    exports2.isScalar = isScalar;
    exports2.prettyToken = prettyToken;
    exports2.tokenType = tokenType;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/parse/lexer.js"(exports2) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer2 = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return yield* this.parseBlockStart();
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i += 1;
                ch = "\n";
                next = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        switch (this.charAt(0)) {
          case "!":
            return (yield* this.pushTag()) + (yield* this.pushSpaces(true)) + (yield* this.pushIndicators());
          case "&":
            return (yield* this.pushUntil(isNotAnchorChar)) + (yield* this.pushSpaces(true)) + (yield* this.pushIndicators());
          case "-":
          // this is an error
          case "?":
          // this is an error outside flow collections
          case ":": {
            const inFlow = this.flowLevel > 0;
            const ch1 = this.charAt(1);
            if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
              if (!inFlow)
                this.indentNext = this.indentValue + 1;
              else if (this.flowKey)
                this.flowKey = false;
              return (yield* this.pushCount(1)) + (yield* this.pushSpaces(true)) + (yield* this.pushIndicators());
            }
          }
        }
        return 0;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports2.Lexer = Lexer2;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/parse/line-counter.js"(exports2) {
    "use strict";
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports2.LineCounter = LineCounter;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/parse/parser.js"(exports2) {
    "use strict";
    var node_process = require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list, type) {
      for (let i = 0; i < list.length; ++i)
        if (list[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list) {
      for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                Array.prototype.push.apply(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              Array.prototype.push.apply(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser2 = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === "block-scalar") {
            token.indent = "indent" in top ? top.indent : 0;
          } else if (token.type === "flow-collection" && top.type === "document") {
            token.indent = 0;
          }
          if (token.type === "flow-collection")
            fixFlowSeqItems(token);
          switch (top.type) {
            case "document":
              top.value = token;
              break;
            case "block-scalar":
              top.props.push(token);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token;
              } else {
                Object.assign(it, { key: token, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token });
              else
                it.value = token;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token, sep: [] });
              else if (it.sep)
                it.value = token;
              else
                Object.assign(it, { key: token, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
            const last = token.items[token.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep;
          if (scalar.end) {
            sep = scalar.end;
            sep.push(this.sourceToken);
            delete scalar.end;
          } else
            sep = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  Array.prototype.push.apply(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep = it.sep;
                  sep.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs);
              } else {
                Object.assign(it, { key: fs, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  Array.prototype.push.apply(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs, sep: [] });
              else if (it.sep)
                this.stack.push(fs);
              else
                Object.assign(it, { key: fs, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep = fc.end.splice(1, fc.end.length);
            sep.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token.end)
              token.end.push(this.sourceToken);
            else
              token.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports2.Parser = Parser2;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/public-api.js"(exports2) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors();
    var log = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse2(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc = parseDocument(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document.Document(value, _replacer, options).toString(options);
    }
    exports2.parse = parse2;
    exports2.parseAllDocuments = parseAllDocuments;
    exports2.parseDocument = parseDocument;
    exports2.stringify = stringify;
  }
});

// node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/index.js"(exports2) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports2.Composer = composer.Composer;
    exports2.Document = Document.Document;
    exports2.Schema = Schema.Schema;
    exports2.YAMLError = errors.YAMLError;
    exports2.YAMLParseError = errors.YAMLParseError;
    exports2.YAMLWarning = errors.YAMLWarning;
    exports2.Alias = Alias.Alias;
    exports2.isAlias = identity.isAlias;
    exports2.isCollection = identity.isCollection;
    exports2.isDocument = identity.isDocument;
    exports2.isMap = identity.isMap;
    exports2.isNode = identity.isNode;
    exports2.isPair = identity.isPair;
    exports2.isScalar = identity.isScalar;
    exports2.isSeq = identity.isSeq;
    exports2.Pair = Pair.Pair;
    exports2.Scalar = Scalar.Scalar;
    exports2.YAMLMap = YAMLMap.YAMLMap;
    exports2.YAMLSeq = YAMLSeq.YAMLSeq;
    exports2.CST = cst;
    exports2.Lexer = lexer.Lexer;
    exports2.LineCounter = lineCounter.LineCounter;
    exports2.Parser = parser.Parser;
    exports2.parse = publicApi.parse;
    exports2.parseAllDocuments = publicApi.parseAllDocuments;
    exports2.parseDocument = publicApi.parseDocument;
    exports2.stringify = publicApi.stringify;
    exports2.visit = visit.visit;
    exports2.visitAsync = visit.visitAsync;
  }
});

// node_modules/.pnpm/unbash@2.2.0/node_modules/unbash/dist/chars.js
var CH_TAB = 9;
var CH_NL = 10;
var CH_SPACE = 32;
var CH_BANG = 33;
var CH_DQUOTE = 34;
var CH_HASH = 35;
var CH_DOLLAR = 36;
var CH_PERCENT = 37;
var CH_AMP = 38;
var CH_SQUOTE = 39;
var CH_LPAREN = 40;
var CH_RPAREN = 41;
var CH_STAR = 42;
var CH_PLUS = 43;
var CH_COMMA = 44;
var CH_DASH = 45;
var CH_SLASH = 47;
var CH_0 = 48;
var CH_9 = 57;
var CH_COLON = 58;
var CH_SEMI = 59;
var CH_LT = 60;
var CH_EQ = 61;
var CH_GT = 62;
var CH_QUESTION = 63;
var CH_AT = 64;
var CH_A = 65;
var CH_Z = 90;
var CH_LBRACKET = 91;
var CH_BACKSLASH = 92;
var CH_RBRACKET = 93;
var CH_CARET = 94;
var CH_UNDERSCORE = 95;
var CH_BACKTICK = 96;
var CH_a = 97;
var CH_z = 122;
var CH_LBRACE = 123;
var CH_PIPE = 124;
var CH_RBRACE = 125;
var CH_TILDE = 126;

// node_modules/.pnpm/unbash@2.2.0/node_modules/unbash/dist/arithmetic.js
function opPrec(op) {
  switch (op) {
    case ",":
      return 1;
    case "=":
    case "+=":
    case "-=":
    case "*=":
    case "/=":
    case "%=":
    case "<<=":
    case ">>=":
    case "&=":
    case "|=":
    case "^=":
      return 2;
    case "||":
      return 4;
    case "&&":
      return 5;
    case "|":
      return 6;
    case "^":
      return 7;
    case "&":
      return 8;
    case "==":
    case "!=":
      return 9;
    case "<":
    case "<=":
    case ">":
    case ">=":
      return 10;
    case "<<":
    case ">>":
      return 11;
    case "+":
    case "-":
      return 12;
    case "*":
    case "/":
    case "%":
      return 13;
    case "**":
      return 14;
    default:
      return -1;
  }
}
function opRightAssoc(op) {
  switch (op) {
    case "=":
    case "+=":
    case "-=":
    case "*=":
    case "/=":
    case "%=":
    case "<<=":
    case ">>=":
    case "&=":
    case "|=":
    case "^=":
    case "**":
      return true;
    default:
      return false;
  }
}
function parseArithmeticExpression(src, offset = 0) {
  let pos = 0;
  const len = src.length;
  function skipWS() {
    while (pos < len) {
      const c = src.charCodeAt(pos);
      if (c === CH_SPACE || c === CH_TAB || c === CH_NL)
        pos++;
      else
        break;
    }
  }
  function tryReadBinOp() {
    if (pos >= len)
      return null;
    const c = src.charCodeAt(pos);
    const nc = pos + 1 < len ? src.charCodeAt(pos + 1) : 0;
    const nnc = pos + 2 < len ? src.charCodeAt(pos + 2) : 0;
    switch (c) {
      case CH_COMMA:
        pos++;
        return ",";
      case CH_EQ:
        if (nc === CH_EQ) {
          pos += 2;
          return "==";
        }
        pos++;
        return "=";
      case CH_BANG:
        if (nc === CH_EQ) {
          pos += 2;
          return "!=";
        }
        return null;
      // unary
      case CH_LT:
        if (nc === CH_LT) {
          if (nnc === CH_EQ) {
            pos += 3;
            return "<<=";
          }
          pos += 2;
          return "<<";
        }
        if (nc === CH_EQ) {
          pos += 2;
          return "<=";
        }
        pos++;
        return "<";
      case CH_GT:
        if (nc === CH_GT) {
          if (nnc === CH_EQ) {
            pos += 3;
            return ">>=";
          }
          pos += 2;
          return ">>";
        }
        if (nc === CH_EQ) {
          pos += 2;
          return ">=";
        }
        pos++;
        return ">";
      case CH_PLUS:
        if (nc === CH_EQ) {
          pos += 2;
          return "+=";
        }
        if (nc === CH_PLUS)
          return null;
        pos++;
        return "+";
      case CH_DASH:
        if (nc === CH_EQ) {
          pos += 2;
          return "-=";
        }
        if (nc === CH_DASH)
          return null;
        pos++;
        return "-";
      case CH_STAR:
        if (nc === CH_STAR) {
          pos += 2;
          return "**";
        }
        if (nc === CH_EQ) {
          pos += 2;
          return "*=";
        }
        pos++;
        return "*";
      case CH_SLASH:
        if (nc === CH_EQ) {
          pos += 2;
          return "/=";
        }
        pos++;
        return "/";
      case CH_PERCENT:
        if (nc === CH_EQ) {
          pos += 2;
          return "%=";
        }
        pos++;
        return "%";
      case CH_PIPE:
        if (nc === CH_PIPE) {
          pos += 2;
          return "||";
        }
        if (nc === CH_EQ) {
          pos += 2;
          return "|=";
        }
        pos++;
        return "|";
      case CH_AMP:
        if (nc === CH_AMP) {
          pos += 2;
          return "&&";
        }
        if (nc === CH_EQ) {
          pos += 2;
          return "&=";
        }
        pos++;
        return "&";
      case CH_CARET:
        if (nc === CH_EQ) {
          pos += 2;
          return "^=";
        }
        pos++;
        return "^";
      case CH_QUESTION:
        pos++;
        return "?";
      default:
        return null;
    }
  }
  function parseBinExpr(minPrec) {
    let left = parseUnaryExpr();
    while (true) {
      skipWS();
      if (pos >= len)
        break;
      const saved = pos;
      const op = tryReadBinOp();
      if (!op)
        break;
      if (op === "?") {
        if (3 < minPrec) {
          pos = saved;
          break;
        }
        const consequent = parseBinExpr(1);
        skipWS();
        if (pos < len && src.charCodeAt(pos) === CH_COLON)
          pos++;
        const alternate = parseBinExpr(3);
        left = { type: "ArithmeticTernary", pos: left.pos, end: alternate.end, test: left, consequent, alternate };
        continue;
      }
      const prec = opPrec(op);
      if (prec < minPrec) {
        pos = saved;
        break;
      }
      const nextPrec = opRightAssoc(op) ? prec : prec + 1;
      const right = parseBinExpr(nextPrec);
      left = { type: "ArithmeticBinary", pos: left.pos, end: right.end, operator: op, left, right };
    }
    return left;
  }
  function parseUnaryExpr() {
    skipWS();
    if (pos >= len)
      return { type: "ArithmeticWord", pos: pos + offset, end: pos + offset, value: "" };
    const start = pos;
    const c = src.charCodeAt(pos);
    const nc = pos + 1 < len ? src.charCodeAt(pos + 1) : 0;
    if (c === CH_PLUS && nc === CH_PLUS) {
      pos += 2;
      const operand = parseUnaryExpr();
      return { type: "ArithmeticUnary", pos: start + offset, end: operand.end, operator: "++", operand, prefix: true };
    }
    if (c === CH_DASH && nc === CH_DASH) {
      pos += 2;
      const operand = parseUnaryExpr();
      return { type: "ArithmeticUnary", pos: start + offset, end: operand.end, operator: "--", operand, prefix: true };
    }
    if (c === CH_BANG) {
      pos++;
      const operand = parseUnaryExpr();
      return { type: "ArithmeticUnary", pos: start + offset, end: operand.end, operator: "!", operand, prefix: true };
    }
    if (c === CH_TILDE) {
      pos++;
      const operand = parseUnaryExpr();
      return { type: "ArithmeticUnary", pos: start + offset, end: operand.end, operator: "~", operand, prefix: true };
    }
    if (c === CH_PLUS && nc !== CH_PLUS && nc !== CH_EQ) {
      pos++;
      const operand = parseUnaryExpr();
      return { type: "ArithmeticUnary", pos: start + offset, end: operand.end, operator: "+", operand, prefix: true };
    }
    if (c === CH_DASH && nc !== CH_DASH && nc !== CH_EQ) {
      pos++;
      const operand = parseUnaryExpr();
      return { type: "ArithmeticUnary", pos: start + offset, end: operand.end, operator: "-", operand, prefix: true };
    }
    return parsePostfixExpr();
  }
  function parsePostfixExpr() {
    const operand = parseAtom();
    skipWS();
    if (pos + 1 < len) {
      const c = src.charCodeAt(pos);
      const nc = src.charCodeAt(pos + 1);
      if (c === CH_PLUS && nc === CH_PLUS) {
        pos += 2;
        return { type: "ArithmeticUnary", pos: operand.pos, end: pos + offset, operator: "++", operand, prefix: false };
      }
      if (c === CH_DASH && nc === CH_DASH) {
        pos += 2;
        return { type: "ArithmeticUnary", pos: operand.pos, end: pos + offset, operator: "--", operand, prefix: false };
      }
    }
    return operand;
  }
  function parseAtom() {
    skipWS();
    if (pos >= len)
      return { type: "ArithmeticWord", pos: pos + offset, end: pos + offset, value: "" };
    const c = src.charCodeAt(pos);
    if (c === CH_LPAREN) {
      const start = pos;
      pos++;
      const expr = parseBinExpr(0);
      skipWS();
      if (pos < len && src.charCodeAt(pos) === CH_RPAREN)
        pos++;
      return { type: "ArithmeticGroup", pos: start + offset, end: pos + offset, expression: expr };
    }
    if (c === CH_DOLLAR) {
      return readDollarAtom();
    }
    return readWordAtom();
  }
  function readDollarAtom() {
    const start = pos;
    pos++;
    if (pos >= len)
      return { type: "ArithmeticWord", pos: start + offset, end: pos + offset, value: "$" };
    const c = src.charCodeAt(pos);
    if (c === CH_LPAREN) {
      if (pos + 1 < len && src.charCodeAt(pos + 1) === CH_LPAREN) {
        pos += 2;
        let depth = 1;
        while (pos < len && depth > 0) {
          if (src.charCodeAt(pos) === CH_LPAREN && pos + 1 < len && src.charCodeAt(pos + 1) === CH_LPAREN) {
            depth++;
            pos += 2;
          } else if (src.charCodeAt(pos) === CH_RPAREN && pos + 1 < len && src.charCodeAt(pos + 1) === CH_RPAREN) {
            depth--;
            if (depth > 0)
              pos += 2;
            else
              pos += 2;
          } else
            pos++;
        }
      } else {
        pos++;
        let depth = 1;
        while (pos < len && depth > 0) {
          const ch = src.charCodeAt(pos);
          if (ch === CH_LPAREN)
            depth++;
          else if (ch === CH_RPAREN)
            depth--;
          pos++;
        }
      }
    } else if (c === CH_LBRACE) {
      pos++;
      let depth = 1;
      while (pos < len && depth > 0) {
        const ch = src.charCodeAt(pos);
        if (ch === CH_LBRACE)
          depth++;
        else if (ch === CH_RBRACE)
          depth--;
        pos++;
      }
    } else {
      while (pos < len) {
        const ch = src.charCodeAt(pos);
        if (ch >= CH_a && ch <= CH_z || ch >= CH_A && ch <= CH_Z || ch >= CH_0 && ch <= CH_9 || ch === CH_UNDERSCORE)
          pos++;
        else
          break;
      }
    }
    return { type: "ArithmeticWord", pos: start + offset, end: pos + offset, value: src.slice(start, pos) };
  }
  function readWordAtom() {
    const start = pos;
    while (pos < len) {
      const c = src.charCodeAt(pos);
      if (c >= CH_0 && c <= CH_9 || c >= CH_A && c <= CH_Z || c >= CH_a && c <= CH_z || c === CH_UNDERSCORE || c === 35) {
        pos++;
      } else
        break;
    }
    if (pos > start && pos < len && src.charCodeAt(pos) === CH_LBRACKET) {
      pos++;
      let depth = 1;
      while (pos < len && depth > 0) {
        const c = src.charCodeAt(pos);
        if (c === CH_LBRACKET)
          depth++;
        else if (c === CH_RBRACKET)
          depth--;
        pos++;
      }
    }
    if (pos === start) {
      pos++;
      return { type: "ArithmeticWord", pos: start + offset, end: pos + offset, value: src.slice(start, pos) };
    }
    return { type: "ArithmeticWord", pos: start + offset, end: pos + offset, value: src.slice(start, pos) };
  }
  skipWS();
  if (pos >= len)
    return null;
  const result = parseBinExpr(0);
  skipWS();
  return result;
}

// node_modules/.pnpm/unbash@2.2.0/node_modules/unbash/dist/word.js
function dequoteValue(parts) {
  let s = "";
  for (const c of parts)
    s += c.type === "Literal" ? c.value : c.text;
  return s;
}
var WordImpl = class _WordImpl {
  static _resolve;
  text;
  pos;
  end;
  #source;
  #parts;
  #value = null;
  constructor(text, pos, end, source) {
    this.text = text;
    this.pos = pos;
    this.end = end;
    this.#source = source ?? "";
    this.#parts = source !== void 0 ? null : void 0;
  }
  get value() {
    if (this.#value === null) {
      const parts = this.parts;
      if (!parts) {
        this.#value = this.text;
      } else {
        let s = "";
        for (const p of parts) {
          switch (p.type) {
            case "Literal":
            case "SingleQuoted":
            case "AnsiCQuoted":
              s += p.value;
              break;
            case "DoubleQuoted":
            case "LocaleString":
              s += dequoteValue(p.parts);
              break;
            default:
              s += p.text;
              break;
          }
        }
        this.#value = s;
      }
    }
    return this.#value;
  }
  get parts() {
    if (this.#parts === null) {
      this.#parts = _WordImpl._resolve(this.#source, this) ?? void 0;
    }
    return this.#parts;
  }
  set parts(v) {
    this.#parts = v ?? void 0;
  }
  toJSON() {
    return { text: this.text, pos: this.pos, end: this.end, parts: this.parts, value: this.value };
  }
};

// node_modules/.pnpm/unbash@2.2.0/node_modules/unbash/dist/lexer.js
var Token = {
  Word: 0,
  Assignment: 1,
  Semi: 2,
  Newline: 3,
  Pipe: 4,
  And: 5,
  Or: 6,
  Amp: 7,
  LParen: 8,
  RParen: 9,
  LBrace: 10,
  RBrace: 11,
  Bang: 12,
  If: 13,
  Then: 14,
  Else: 15,
  Elif: 16,
  Fi: 17,
  Do: 18,
  Done: 19,
  For: 20,
  While: 21,
  Until: 22,
  In: 23,
  Case: 24,
  Esac: 25,
  Function: 26,
  DoubleSemi: 27,
  SemiAmp: 28,
  DoubleSemiAmp: 29,
  Select: 30,
  DblLBracket: 31,
  DblRBracket: 32,
  EOF: 33,
  ArithCmd: 34,
  Coproc: 35,
  Redirect: 36
};
var TokenValue = class {
  token = Token.EOF;
  value = "";
  pos = 0;
  end = 0;
  fileDescriptor = void 0;
  variableName = void 0;
  content = void 0;
  targetPos = 0;
  targetEnd = 0;
  reset() {
    this.token = Token.EOF;
    this.value = "";
    this.pos = 0;
    this.end = 0;
    this.fileDescriptor = void 0;
    this.variableName = void 0;
    this.content = void 0;
    this.targetPos = 0;
    this.targetEnd = 0;
  }
  copyFrom(other) {
    this.token = other.token;
    this.value = other.value;
    this.pos = other.pos;
    this.end = other.end;
    this.fileDescriptor = other.fileDescriptor;
    this.variableName = other.variableName;
    this.content = other.content;
    this.targetPos = other.targetPos;
    this.targetEnd = other.targetEnd;
  }
};
var RESERVED_WORDS = {
  if: Token.If,
  then: Token.Then,
  else: Token.Else,
  elif: Token.Elif,
  fi: Token.Fi,
  do: Token.Do,
  done: Token.Done,
  for: Token.For,
  while: Token.While,
  until: Token.Until,
  in: Token.In,
  case: Token.Case,
  esac: Token.Esac,
  function: Token.Function,
  select: Token.Select,
  coproc: Token.Coproc,
  "!": Token.Bang,
  "{": Token.LBrace,
  "}": Token.RBrace
};
var charType = new Uint8Array(128);
charType[CH_PIPE] = 1;
charType[CH_AMP] = 1;
charType[CH_SEMI] = 1;
charType[CH_LPAREN] = 1;
charType[CH_RPAREN] = 1;
charType[CH_LT] = 1;
charType[CH_GT] = 1;
charType[CH_SPACE] = 1;
charType[CH_TAB] = 1;
charType[CH_NL] = 1;
charType[CH_BACKSLASH] = 2;
charType[CH_SQUOTE] = 2;
charType[CH_DQUOTE] = 2;
charType[CH_DOLLAR] = 2;
charType[CH_BACKTICK] = 2;
charType[CH_LBRACE] = 2;
function findUnnested(s, target) {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === CH_BACKSLASH) {
      i++;
      continue;
    }
    if (c === CH_LBRACE) {
      depth++;
      continue;
    }
    if (c === CH_RBRACE) {
      if (depth > 0)
        depth--;
      continue;
    }
    if (c === CH_SQUOTE) {
      i++;
      while (i < s.length && s.charCodeAt(i) !== CH_SQUOTE)
        i++;
      continue;
    }
    if (c === CH_DQUOTE) {
      i++;
      while (i < s.length && s.charCodeAt(i) !== CH_DQUOTE) {
        if (s.charCodeAt(i) === CH_BACKSLASH)
          i++;
        i++;
      }
      continue;
    }
    if (c === target && depth === 0)
      return i;
  }
  return -1;
}
var isIdChar = new Uint8Array(128);
for (let i = CH_a; i <= CH_z; i++)
  isIdChar[i] = 3;
for (let i = CH_A; i <= CH_Z; i++)
  isIdChar[i] = 3;
for (let i = CH_0; i <= CH_9; i++)
  isIdChar[i] = 2;
isIdChar[CH_UNDERSCORE] = 3;
var extglobPrefix = new Uint8Array(128);
extglobPrefix[CH_QUESTION] = 1;
extglobPrefix[CH_AT] = 1;
extglobPrefix[CH_STAR] = 1;
extglobPrefix[CH_PLUS] = 1;
extglobPrefix[CH_BANG] = 1;
extglobPrefix[CH_EQ] = 1;
var extglobOp = {
  [CH_QUESTION]: "?",
  [CH_AT]: "@",
  [CH_STAR]: "*",
  [CH_PLUS]: "+",
  [CH_BANG]: "!"
};
function isDQChild(p) {
  const t = p.type;
  return t === "Literal" || t === "SimpleExpansion" || t === "ParameterExpansion" || t === "CommandExpansion" || t === "ArithmeticExpansion";
}
function isAllDigits(text) {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < CH_0 || c > CH_9)
      return false;
  }
  return text.length > 0;
}
function isAssignmentWord(text) {
  const eqIdx = text.indexOf("=");
  if (eqIdx <= 0)
    return false;
  let c = text.charCodeAt(0);
  if (c >= 128 || !(isIdChar[c] & 1))
    return false;
  let i = 1;
  for (; i < eqIdx; i++) {
    c = text.charCodeAt(i);
    if (c >= 128 || !(isIdChar[c] & 2))
      break;
  }
  if (i === eqIdx)
    return true;
  if (c === CH_PLUS && i + 1 === eqIdx)
    return true;
  if (c === CH_LBRACKET) {
    const rbIdx = text.indexOf("]", i + 1);
    if (rbIdx > i && (rbIdx + 1 === eqIdx || text.charCodeAt(rbIdx + 1) === CH_PLUS && rbIdx + 2 === eqIdx))
      return true;
  }
  return false;
}
function setToken(out, token, value, pos = 0, end = 0) {
  out.token = token;
  out.value = value;
  out.pos = pos;
  out.end = end;
  out.fileDescriptor = void 0;
  out.variableName = void 0;
  out.content = void 0;
}
var LexContext = {
  Normal: 0,
  CommandStart: 1,
  TestMode: 2
};
function scanBraceExpansion(src, pos, len) {
  const nextCh = pos + 1 < len ? src.charCodeAt(pos + 1) : 0;
  if (nextCh <= CH_SPACE || nextCh === CH_RBRACE)
    return -1;
  let depth = 1;
  let hasSep = false;
  let scanPos = pos + 1;
  while (scanPos < len && depth > 0) {
    const bc = src.charCodeAt(scanPos);
    if (bc === CH_LBRACE)
      depth++;
    else if (bc === CH_RBRACE) {
      if (--depth === 0)
        break;
    } else if (bc <= CH_SPACE || bc === CH_SEMI || bc === CH_PIPE || bc === CH_AMP)
      return -1;
    else if (depth === 1 && (bc === 44 || bc === 46 && scanPos + 1 < len && src.charCodeAt(scanPos + 1) === 46))
      hasSep = true;
    if (bc === CH_BACKSLASH)
      scanPos++;
    scanPos++;
  }
  if (depth === 0 && hasSep)
    return scanPos + 1;
  return -1;
}
var Lexer = class {
  src;
  pos;
  current;
  nextState;
  hasPeek;
  pendingHereDocs;
  collectedExpansions;
  _errors = null;
  _buildParts = false;
  constructor(src) {
    this.src = src;
    this.pos = 0;
    this.current = new TokenValue();
    this.nextState = new TokenValue();
    this.hasPeek = false;
    this.pendingHereDocs = [];
    this.collectedExpansions = [];
    if (src.charCodeAt(0) === CH_HASH && src.charCodeAt(1) === CH_BANG) {
      const nl = src.indexOf("\n");
      this.pos = nl === -1 ? src.length : nl + 1;
    }
  }
  get errors() {
    return this._errors ?? (this._errors = []);
  }
  getCollectedExpansions() {
    return this.collectedExpansions;
  }
  getPos() {
    return this.pos;
  }
  /** Set position and scan a word, building parts. Used by computeWordParts. */
  buildWordParts(startPos) {
    this._buildParts = true;
    this.pos = startPos;
    const ch = this.src.charCodeAt(startPos);
    if ((ch === 60 || ch === 62) && startPos + 1 < this.src.length && this.src.charCodeAt(startPos + 1) === 40) {
      this.pos = startPos + 2;
      const inner = this.extractBalanced();
      const text = this.src.slice(startPos, this.pos);
      const part = {
        type: "ProcessSubstitution",
        text,
        operator: ch === 60 ? "<" : ">",
        script: void 0,
        inner: inner ?? void 0
      };
      const exp = { inner: inner ?? void 0, _part: part };
      this.collectedExpansions.push(exp);
      if (this.pos < this.src.length) {
        this.readWordText();
        if (this._wordParts) {
          this._wordParts.unshift(part);
        } else {
          this._wordParts = [part];
        }
      } else {
        this._wordParts = [part];
      }
    } else {
      this.readWordText();
    }
    return this._wordParts;
  }
  /** Scan a heredoc body for expansions, building parts. Spaces/newlines are literal. */
  buildHereDocParts(bodyPos, bodyEnd) {
    this._buildParts = true;
    const src = this.src;
    const parts = [];
    let litBuf = "";
    let litStart = bodyPos;
    let i = bodyPos;
    const flushLit = () => {
      if (litBuf) {
        parts.push({ type: "Literal", value: litBuf, text: src.slice(litStart, i) });
        litBuf = "";
      }
    };
    while (i < bodyEnd) {
      const ch = src.charCodeAt(i);
      if (ch === 92) {
        if (i + 1 < bodyEnd) {
          const nc = src.charCodeAt(i + 1);
          if (nc === 36 || nc === 96 || nc === 92) {
            litBuf += String.fromCharCode(nc);
            i += 2;
            continue;
          }
        }
        litBuf += "\\";
        i++;
        continue;
      }
      if (ch === 36) {
        flushLit();
        litStart = i;
        this.pos = i;
        this.readDollar();
        if (this._resultPart) {
          parts.push(this._resultPart);
          litStart = this.pos;
        } else {
          litBuf += src.slice(i, this.pos);
        }
        i = this.pos;
        continue;
      }
      if (ch === 96) {
        flushLit();
        litStart = i;
        this.pos = i;
        this.readBacktickExpansion();
        if (this._resultPart) {
          parts.push(this._resultPart);
          litStart = this.pos;
        } else {
          litBuf += src.slice(i, this.pos);
        }
        i = this.pos;
        continue;
      }
      litBuf += src[i];
      i++;
    }
    flushLit();
    return parts.length > 1 || parts.length === 1 && parts[0].type !== "Literal" ? parts : null;
  }
  registerHereDocTarget(target) {
    for (const hd of this.pendingHereDocs) {
      if (!hd.target) {
        hd.target = target;
        return;
      }
    }
  }
  // Read the right-hand operand of =~ in [[ ]]. Parentheses and pipe are not
  // metacharacters in regex patterns, so we temporarily clear their charType
  // entries so that readWord's fast/slow path treats them as plain chars.
  readTestRegexWord() {
    this.hasPeek = false;
    const chars = [CH_LPAREN, CH_RPAREN, CH_PIPE, CH_LT, CH_GT];
    const saved = chars.map((c) => charType[c]);
    for (const c of chars)
      charType[c] = 0;
    try {
      this.skipSpacesAndTabs();
      this.readWord(this.current, LexContext.Normal, this.pos);
      return this.current;
    } finally {
      for (let i = 0; i < chars.length; i++)
        charType[chars[i]] = saved[i];
    }
  }
  // Read C-style for expressions: called after first '(' consumed by parser.
  // Expects pos at second '('. Returns [init, test, update] raw text.
  readCStyleForExprs() {
    this.hasPeek = false;
    const src = this.src;
    const len = src.length;
    while (this.pos < len && (src.charCodeAt(this.pos) === CH_SPACE || src.charCodeAt(this.pos) === CH_TAB))
      this.pos++;
    if (this.pos < len && src.charCodeAt(this.pos) === CH_LPAREN)
      this.pos++;
    const starts = [this.pos, 0, 0];
    const parts = ["", "", "", 0, 0, 0];
    let partIdx = 0;
    let depth = 1;
    let partStart = this.pos;
    while (this.pos < len && depth > 0) {
      const c = src.charCodeAt(this.pos);
      if (c === CH_LPAREN) {
        depth++;
        this.pos++;
      } else if (c === CH_RPAREN) {
        depth--;
        if (depth === 0) {
          const raw = src.slice(partStart, this.pos);
          parts[partIdx] = raw.trim();
          parts[3 + partIdx] = starts[partIdx] + raw.length - raw.trimStart().length;
          this.pos++;
          while (this.pos < len && (src.charCodeAt(this.pos) === CH_SPACE || src.charCodeAt(this.pos) === CH_TAB))
            this.pos++;
          if (this.pos < len && src.charCodeAt(this.pos) === CH_RPAREN)
            this.pos++;
          break;
        }
        this.pos++;
      } else if (c === CH_SEMI && depth === 1) {
        const raw = src.slice(partStart, this.pos);
        parts[partIdx] = raw.trim();
        parts[3 + partIdx] = starts[partIdx] + raw.length - raw.trimStart().length;
        if (partIdx < 2)
          partIdx++;
        this.pos++;
        partStart = this.pos;
        starts[partIdx] = partStart;
      } else if (c === CH_SQUOTE) {
        this.pos++;
        this.skipSQ();
      } else if (c === CH_DQUOTE) {
        this.pos++;
        this.skipDQ();
      } else {
        this.pos++;
      }
    }
    return parts;
  }
  peek(ctx = LexContext.Normal) {
    if (!this.hasPeek) {
      this.readNext(this.nextState, ctx);
      this.hasPeek = true;
    }
    return this.nextState;
  }
  next(ctx = LexContext.Normal) {
    if (this.hasPeek) {
      this.hasPeek = false;
      const temp = this.current;
      this.current = this.nextState;
      this.nextState = temp;
      return this.current;
    }
    this.readNext(this.current, ctx);
    return this.current;
  }
  unshift(tok) {
    this.nextState.copyFrom(tok);
    this.hasPeek = true;
  }
  readNext(out, ctx) {
    const src = this.src;
    const len = src.length;
    let pos = this.pos;
    while (pos < len) {
      const ch2 = src.charCodeAt(pos);
      if (ch2 === CH_SPACE || ch2 === CH_TAB) {
        pos++;
        continue;
      }
      if (ch2 === CH_BACKSLASH && pos + 1 < len && src.charCodeAt(pos + 1) === CH_NL) {
        pos += 2;
        continue;
      }
      if (ch2 === CH_NL && ctx === LexContext.TestMode) {
        pos++;
        continue;
      }
      break;
    }
    this.pos = pos;
    if (pos >= len) {
      setToken(out, Token.EOF, "", pos, pos);
      return;
    }
    const tokenStart = pos;
    const ch = src.charCodeAt(pos);
    if (ch === CH_HASH) {
      while (this.pos < len && src.charCodeAt(this.pos) !== CH_NL)
        this.pos++;
      this.readNext(out, ctx);
      return;
    }
    if (ch === CH_NL) {
      this.pos++;
      this.consumePendingHereDocs();
      setToken(out, Token.Newline, "\n", tokenStart, this.pos);
      return;
    }
    if (ctx === LexContext.TestMode && (ch === CH_LT || ch === CH_GT)) {
      this.pos++;
      setToken(out, Token.Word, ch === CH_LT ? "<" : ">", tokenStart, this.pos);
      return;
    }
    if (this.tryReadOperator(out, ch, ctx, tokenStart))
      return;
    this.readWord(out, ctx, tokenStart);
  }
  tryReadOperator(out, ch, ctx, tokenStart) {
    const src = this.src;
    const pos = this.pos;
    const next = pos + 1 < src.length ? src.charCodeAt(pos + 1) : 0;
    switch (ch) {
      case CH_SEMI:
        if (next === CH_SEMI) {
          if (pos + 2 < src.length && src.charCodeAt(pos + 2) === CH_AMP) {
            this.pos += 3;
            setToken(out, Token.DoubleSemiAmp, ";;&", tokenStart, this.pos);
            return true;
          }
          this.pos += 2;
          setToken(out, Token.DoubleSemi, ";;", tokenStart, this.pos);
          return true;
        }
        if (next === CH_AMP) {
          this.pos += 2;
          setToken(out, Token.SemiAmp, ";&", tokenStart, this.pos);
          return true;
        }
        this.pos++;
        setToken(out, Token.Semi, ";", tokenStart, this.pos);
        return true;
      case CH_PIPE:
        if (next === CH_PIPE) {
          this.pos += 2;
          setToken(out, Token.Or, "||", tokenStart, this.pos);
          return true;
        }
        if (next === CH_AMP) {
          this.pos += 2;
          setToken(out, Token.Pipe, "|&", tokenStart, this.pos);
          return true;
        }
        this.pos++;
        setToken(out, Token.Pipe, "|", tokenStart, this.pos);
        return true;
      case CH_AMP:
        if (next === CH_AMP) {
          this.pos += 2;
          setToken(out, Token.And, "&&", tokenStart, this.pos);
          return true;
        }
        if (next === CH_GT) {
          this.pos += 2;
          const append = this.pos < src.length && src.charCodeAt(this.pos) === CH_GT;
          if (append)
            this.pos++;
          this.skipSpacesAndTabs();
          this._redirectTargetPos = this.pos;
          if (this.pos < src.length && src.charCodeAt(this.pos) !== CH_NL)
            this.readWordText();
          this.redirectToken(out, append ? "&>>" : "&>", tokenStart);
          return true;
        }
        this.pos++;
        setToken(out, Token.Amp, "&", tokenStart, this.pos);
        return true;
      case CH_LPAREN:
        if (ctx === LexContext.CommandStart && next === CH_LPAREN) {
          this.readArithmeticCommand(out, tokenStart);
          return true;
        }
        this.pos++;
        setToken(out, Token.LParen, "(", tokenStart, this.pos);
        return true;
      case CH_RPAREN:
        this.pos++;
        setToken(out, Token.RParen, ")", tokenStart, this.pos);
        return true;
      case CH_LT:
      case CH_GT:
        return this.readRedirection(out, tokenStart);
      default:
        return false;
    }
  }
  readRedirection(out, tokenStart) {
    const src = this.src;
    const ch = src.charCodeAt(this.pos);
    let op = "";
    if (ch === CH_LT) {
      this.pos++;
      const next = this.pos < src.length ? src.charCodeAt(this.pos) : 0;
      if (next === CH_LT) {
        this.pos++;
        const third = this.pos < src.length ? src.charCodeAt(this.pos) : 0;
        if (third === CH_LT) {
          this.pos++;
          this.skipSpacesAndTabs();
          this._redirectTargetPos = this.pos;
          if (this.pos < src.length && src.charCodeAt(this.pos) !== CH_NL)
            this.readWordText();
          this.redirectToken(out, "<<<", tokenStart);
          return true;
        }
        const dash = third === CH_DASH;
        if (dash)
          this.pos++;
        this.skipSpacesAndTabs();
        this.readHereDocDelimiter();
        this.pendingHereDocs.push({ delimiter: this._hereDelim, strip: dash, quoted: this._hereQuoted });
        setToken(out, Token.Redirect, dash ? "<<-" : "<<", tokenStart, this.pos);
        out.content = this._hereDelim;
        return true;
      }
      if (next === CH_LPAREN) {
        this.readProcessSubstitution(out, "<", tokenStart);
        return true;
      }
      if (next === CH_GT) {
        op = "<>";
        this.pos++;
      } else if (next === CH_AMP) {
        op = "<&";
        this.pos++;
      } else {
        op = "<";
      }
    } else if (ch === CH_GT) {
      this.pos++;
      const next = this.pos < src.length ? src.charCodeAt(this.pos) : 0;
      if (next === CH_LPAREN) {
        this.readProcessSubstitution(out, ">", tokenStart);
        return true;
      }
      if (next === CH_GT) {
        op = ">>";
        this.pos++;
      } else if (next === CH_AMP) {
        op = ">&";
        this.pos++;
      } else if (next === CH_PIPE) {
        op = ">|";
        this.pos++;
      } else {
        op = ">";
      }
    }
    this.skipSpacesAndTabs();
    if (this.pos < src.length) {
      const nc = src.charCodeAt(this.pos);
      if ((nc === CH_LT || nc === CH_GT) && this.pos + 1 < src.length && src.charCodeAt(this.pos + 1) === CH_LPAREN) {
        const psStart = this.pos;
        this.pos += 2;
        this.extractBalanced();
        const psText = src.slice(psStart, this.pos);
        setToken(out, Token.Redirect, op, tokenStart, this.pos);
        out.content = psText;
        out.targetPos = psStart;
        out.targetEnd = this.pos;
        return true;
      }
      this._redirectTargetPos = this.pos;
      if (nc !== CH_NL)
        this.readWordText();
    }
    this.redirectToken(out, op, tokenStart);
    return true;
  }
  redirectToken(out, operator, tokenStart) {
    setToken(out, Token.Redirect, operator, tokenStart, this.pos);
    out.content = this._wordText;
    out.targetPos = this._redirectTargetPos;
    out.targetEnd = this.pos;
  }
  readProcessSubstitution(out, operator, tokenStart) {
    this.pos++;
    this.extractBalanced();
    const text = this.src.slice(tokenStart, this.pos);
    setToken(out, Token.Word, text, tokenStart, this.pos);
  }
  readHereDocDelimiter() {
    const src = this.src;
    const len = src.length;
    let delimiter = "";
    if (this.pos < len && src.charCodeAt(this.pos) === CH_SQUOTE) {
      this.pos++;
      const start = this.pos;
      while (this.pos < len && src.charCodeAt(this.pos) !== CH_SQUOTE)
        this.pos++;
      delimiter = src.slice(start, this.pos);
      if (this.pos < len)
        this.pos++;
      this._hereDelim = delimiter;
      this._hereQuoted = true;
      return;
    } else if (this.pos < len && src.charCodeAt(this.pos) === CH_DQUOTE) {
      this.pos++;
      while (this.pos < len && src.charCodeAt(this.pos) !== CH_DQUOTE) {
        if (src.charCodeAt(this.pos) === CH_BACKSLASH)
          this.pos++;
        delimiter += src[this.pos];
        this.pos++;
      }
      if (this.pos < len)
        this.pos++;
      this._hereDelim = delimiter;
      this._hereQuoted = true;
      return;
    } else if (this.pos < len && src.charCodeAt(this.pos) === CH_BACKSLASH) {
      while (this.pos < len) {
        const c = src.charCodeAt(this.pos);
        if (c < 128 && charType[c] & 1)
          break;
        if (c === CH_BACKSLASH)
          this.pos++;
        if (this.pos < len) {
          delimiter += src[this.pos];
          this.pos++;
        }
      }
      this._hereDelim = delimiter;
      this._hereQuoted = true;
      return;
    } else {
      const start = this.pos;
      while (this.pos < len) {
        const c = src.charCodeAt(this.pos);
        if (c < 128 && charType[c] & 1)
          break;
        this.pos++;
      }
      this._hereDelim = src.slice(start, this.pos);
      this._hereQuoted = false;
    }
  }
  consumePendingHereDocs() {
    for (const hd of this.pendingHereDocs) {
      const bodyPos = this.pos;
      const body = this.readHereDocBody(hd.delimiter, hd.strip);
      if (hd.target) {
        hd.target.content = body;
        if (hd.quoted) {
          hd.target.heredocQuoted = true;
        } else if (body) {
          const parsed = this.parseHereDocBody(body, bodyPos);
          if (parsed)
            hd.target.body = parsed;
        }
      }
    }
    this.pendingHereDocs.length = 0;
  }
  readHereDocBody(delimiter, strip) {
    const src = this.src;
    const len = src.length;
    const dLen = delimiter.length;
    const bodyStart = this.pos;
    while (this.pos < len) {
      let lineStart = this.pos;
      let lineEnd = src.indexOf("\n", this.pos);
      if (lineEnd === -1)
        lineEnd = len;
      if (strip) {
        while (lineStart < lineEnd && src.charCodeAt(lineStart) === CH_TAB)
          lineStart++;
      }
      if (lineEnd - lineStart === dLen && src.startsWith(delimiter, lineStart)) {
        const body = src.slice(bodyStart, this.pos);
        this.pos = lineEnd < len ? lineEnd + 1 : lineEnd;
        return body;
      }
      this.pos = lineEnd < len ? lineEnd + 1 : lineEnd;
    }
    return src.slice(bodyStart, this.pos);
  }
  // Scan an unquoted heredoc body for expansions ($var, ${...}, $(...), `...`).
  // Returns a Word (without parts — use computeWordParts for those) if expansions exist.
  parseHereDocBody(body, bodyPos) {
    let hasExpansion = false;
    for (let i = 0; i < body.length; i++) {
      const c = body.charCodeAt(i);
      if (c === CH_BACKTICK) {
        hasExpansion = true;
        break;
      }
      if (c === CH_DOLLAR) {
        const next = i + 1 < body.length ? body.charCodeAt(i + 1) : 0;
        if (next === CH_LBRACE || next === CH_LPAREN || next === CH_DOLLAR || next >= CH_a && next <= CH_z || next >= CH_A && next <= CH_Z || next === CH_UNDERSCORE || next === CH_BANG || next === CH_HASH || next === CH_AT || next === CH_STAR || next === CH_QUESTION || next === CH_DASH || next >= CH_0 && next <= CH_9) {
          hasExpansion = true;
          break;
        }
      }
      if (c === CH_BACKSLASH)
        i++;
    }
    if (!hasExpansion)
      return null;
    return new WordImpl(body, bodyPos, bodyPos + body.length);
  }
  _wordText = "";
  _wordQuoted = false;
  _wordHasExpansions = false;
  _wordParts = null;
  _redirectTargetPos = 0;
  _resultText = "";
  _resultHasExpansion = false;
  _resultPart;
  _dqText = "";
  _dqHasExpansions = false;
  _dqParts = null;
  _hereDelim = "";
  _hereQuoted = false;
  readWord(out, ctx, tokenStart = 0) {
    this.readWordText();
    const text = this._wordText;
    const hasExpansions = this._wordHasExpansions;
    const quoted = this._wordQuoted;
    const wordEnd = this.pos;
    if (ctx === LexContext.CommandStart) {
      if (!hasExpansions && !quoted) {
        const fc = text.charCodeAt(0);
        if ((fc >= CH_a && fc <= CH_z && text.length <= 8 || fc === CH_BANG || fc === CH_LBRACE || fc === CH_RBRACE) && text in RESERVED_WORDS) {
          setToken(out, RESERVED_WORDS[text], text, tokenStart, wordEnd);
          return;
        }
        if (fc === CH_LBRACKET && text === "[[") {
          setToken(out, Token.DblLBracket, text, tokenStart, wordEnd);
          return;
        }
      }
      if (isAssignmentWord(text)) {
        setToken(out, Token.Assignment, text, tokenStart, wordEnd);
        return;
      }
    }
    if (!hasExpansions && !quoted && text === "]]") {
      setToken(out, Token.DblRBracket, text, tokenStart, wordEnd);
      return;
    }
    if (!hasExpansions && this.pos < this.src.length) {
      const nc = this.src.charCodeAt(this.pos);
      if (nc === CH_LT || nc === CH_GT) {
        if (text.charCodeAt(0) >= CH_0 && text.charCodeAt(0) <= CH_9 && isAllDigits(text)) {
          const fd = Number.parseInt(text, 10);
          if (this.readRedirection(out, tokenStart)) {
            out.fileDescriptor = fd;
            return;
          }
        }
        if (text.charCodeAt(0) === CH_LBRACE && text.charCodeAt(text.length - 1) === CH_RBRACE && text.length > 2) {
          const varname = text.slice(1, -1);
          if (this.readRedirection(out, tokenStart)) {
            out.variableName = varname;
            return;
          }
        }
      }
    }
    setToken(out, Token.Word, text, tokenStart, wordEnd);
  }
  readWordText() {
    const src = this.src;
    const len = src.length;
    let pos = this.pos;
    const fastStart = pos;
    while (pos < len) {
      const c = src.charCodeAt(pos);
      if (c < 128 && charType[c])
        break;
      pos++;
    }
    const exitCh = pos < len ? src.charCodeAt(pos) : 0;
    if (pos >= len || charType[exitCh] & 1 && !(exitCh === CH_LPAREN && pos > fastStart && extglobPrefix[src.charCodeAt(pos - 1)])) {
      this.pos = pos;
      this._wordText = pos > fastStart ? src.slice(fastStart, pos) : "";
      this._wordQuoted = false;
      this._wordHasExpansions = false;
      if (this._buildParts)
        this._wordParts = null;
      return;
    }
    let text = pos > fastStart ? src.slice(fastStart, pos) : "";
    let quoted = false;
    let hasExpansions = false;
    const bp = this._buildParts;
    let parts;
    let litBuf = "";
    let litStart = 0;
    if (bp) {
      parts = [];
      litBuf = text;
      litStart = fastStart;
    }
    while (pos < len) {
      const ch = src.charCodeAt(pos);
      if (ch >= 128 || !charType[ch]) {
        const runStart = pos;
        pos++;
        while (pos < len) {
          const c = src.charCodeAt(pos);
          if (c < 128 && charType[c])
            break;
          pos++;
        }
        const chunk = src.slice(runStart, pos);
        text += chunk;
        if (bp)
          litBuf += chunk;
        continue;
      }
      if (charType[ch] & 1) {
        if (ch === CH_LPAREN && text.length > 0 && extglobPrefix[text.charCodeAt(text.length - 1)]) {
          const prefixChar = text.charCodeAt(text.length - 1);
          pos++;
          const innerStart = pos;
          let depth = 1;
          while (pos < len && depth > 0) {
            const c = src.charCodeAt(pos);
            if (c === CH_LPAREN)
              depth++;
            else if (c === CH_RPAREN)
              depth--;
            pos++;
          }
          const pattern = src.slice(innerStart, pos - 1);
          const eg = "(" + src.slice(innerStart, pos);
          text += eg;
          if (bp && prefixChar !== CH_EQ) {
            if (litBuf.length > 0) {
              const trimmed = litBuf.slice(0, -1);
              if (trimmed)
                parts.push({ type: "Literal", value: trimmed, text: src.slice(litStart, innerStart - 2) });
              litBuf = "";
            }
            const op = extglobOp[prefixChar];
            const fullText = op + eg;
            parts.push({ type: "ExtendedGlob", text: fullText, operator: op, pattern });
            litStart = pos;
          } else if (bp) {
            litBuf += eg;
          }
          continue;
        }
        break;
      }
      if (ch === CH_BACKSLASH) {
        pos++;
        if (pos < len) {
          if (src.charCodeAt(pos) === CH_NL) {
            pos++;
          } else {
            quoted = true;
            const escaped = src[pos++];
            text += escaped;
            if (bp)
              litBuf += escaped;
          }
        }
        continue;
      }
      if (ch === CH_SQUOTE) {
        const sqStart = pos;
        quoted = true;
        pos++;
        const start = pos;
        while (pos < len && src.charCodeAt(pos) !== CH_SQUOTE)
          pos++;
        const value = src.slice(start, pos);
        text += value;
        if (pos < len)
          pos++;
        else
          this.errors.push({ message: "unterminated single quote", pos: start - 1 });
        if (bp) {
          if (litBuf) {
            parts.push({ type: "Literal", value: litBuf, text: src.slice(litStart, sqStart) });
            litBuf = "";
          }
          parts.push({ type: "SingleQuoted", value, text: src.slice(sqStart, pos) });
          litStart = pos;
        }
        continue;
      }
      if (ch === CH_DQUOTE) {
        const dqStart = pos;
        quoted = true;
        pos++;
        this.pos = pos;
        this.readDoubleQuoted();
        pos = this.pos;
        text += this._dqText;
        if (this._dqHasExpansions)
          hasExpansions = true;
        if (bp) {
          if (litBuf) {
            parts.push({ type: "Literal", value: litBuf, text: src.slice(litStart, dqStart) });
            litBuf = "";
          }
          const dqText = src.slice(dqStart, pos);
          parts.push({
            type: "DoubleQuoted",
            text: dqText,
            parts: this._dqParts ?? [{ type: "Literal", value: this._dqText, text: src.slice(dqStart + 1, pos - 1) }]
          });
          litStart = pos;
        }
        continue;
      }
      if (ch === CH_DOLLAR) {
        const dollarStart = pos;
        this.pos = pos;
        this.readDollar();
        pos = this.pos;
        text += this._resultText;
        if (this._resultHasExpansion)
          hasExpansions = true;
        if (bp) {
          if (this._resultPart) {
            if (litBuf) {
              parts.push({ type: "Literal", value: litBuf, text: src.slice(litStart, dollarStart) });
              litBuf = "";
            }
            parts.push(this._resultPart);
            litStart = pos;
          } else {
            litBuf += this._resultText;
          }
        }
        continue;
      }
      if (ch === CH_BACKTICK) {
        const btStart = pos;
        this.pos = pos;
        this.readBacktickExpansion();
        pos = this.pos;
        text += this._resultText;
        hasExpansions = true;
        if (bp) {
          if (litBuf) {
            parts.push({ type: "Literal", value: litBuf, text: src.slice(litStart, btStart) });
            litBuf = "";
          }
          parts.push(this._resultPart);
          litStart = pos;
        }
        continue;
      }
      if (ch === CH_LBRACE) {
        const braceEnd = scanBraceExpansion(src, pos, len);
        if (braceEnd > 0) {
          const braceText = src.slice(pos, braceEnd);
          text += braceText;
          if (bp) {
            if (litBuf) {
              parts.push({ type: "Literal", value: litBuf, text: src.slice(litStart, pos) });
              litBuf = "";
            }
            parts.push({ type: "BraceExpansion", text: braceText });
            litStart = braceEnd;
          }
          pos = braceEnd;
          continue;
        }
        text += "{";
        if (bp)
          litBuf += "{";
        pos++;
        continue;
      }
      pos++;
    }
    if (bp && litBuf)
      parts.push({ type: "Literal", value: litBuf, text: src.slice(litStart, pos) });
    this.pos = pos;
    this._wordText = text;
    this._wordQuoted = quoted;
    this._wordHasExpansions = hasExpansions;
    if (bp) {
      this._wordParts = parts.length > 1 || parts.length === 1 && parts[0].type !== "Literal" ? parts : null;
    }
  }
  readInnerWordText() {
    const src = this.src;
    const len = src.length;
    let pos = this.pos;
    let text = "";
    const bp = this._buildParts;
    let parts;
    let litBuf = "";
    let litStart = 0;
    if (bp) {
      parts = [];
      litStart = pos;
    }
    while (pos < len) {
      const ch = src.charCodeAt(pos);
      if (ch === CH_BACKSLASH) {
        pos++;
        if (pos < len) {
          if (src.charCodeAt(pos) === CH_NL) {
            pos++;
          } else {
            const escaped = src[pos++];
            text += escaped;
            if (bp)
              litBuf += escaped;
          }
        }
        continue;
      }
      if (ch === CH_SQUOTE) {
        const sqStart = pos;
        pos++;
        const start = pos;
        while (pos < len && src.charCodeAt(pos) !== CH_SQUOTE)
          pos++;
        const value = src.slice(start, pos);
        text += value;
        if (pos < len)
          pos++;
        if (bp) {
          if (litBuf) {
            parts.push({ type: "Literal", value: litBuf, text: src.slice(litStart, sqStart) });
            litBuf = "";
          }
          parts.push({ type: "SingleQuoted", value, text: src.slice(sqStart, pos) });
          litStart = pos;
        }
        continue;
      }
      if (ch === CH_DQUOTE) {
        const dqStart = pos;
        pos++;
        this.pos = pos;
        this.readDoubleQuoted();
        pos = this.pos;
        text += this._dqText;
        if (bp) {
          if (litBuf) {
            parts.push({ type: "Literal", value: litBuf, text: src.slice(litStart, dqStart) });
            litBuf = "";
          }
          const dqText = src.slice(dqStart, pos);
          parts.push({
            type: "DoubleQuoted",
            text: dqText,
            parts: this._dqParts ?? [{ type: "Literal", value: this._dqText, text: src.slice(dqStart + 1, pos - 1) }]
          });
          litStart = pos;
        }
        continue;
      }
      if (ch === CH_DOLLAR) {
        const dollarStart = pos;
        this.pos = pos;
        this.readDollar();
        pos = this.pos;
        text += this._resultText;
        if (bp) {
          if (this._resultPart) {
            if (litBuf) {
              parts.push({ type: "Literal", value: litBuf, text: src.slice(litStart, dollarStart) });
              litBuf = "";
            }
            parts.push(this._resultPart);
            litStart = pos;
          } else {
            litBuf += this._resultText;
          }
        }
        continue;
      }
      if (ch === CH_BACKTICK) {
        const btStart = pos;
        this.pos = pos;
        this.readBacktickExpansion();
        pos = this.pos;
        text += this._resultText;
        if (bp) {
          if (litBuf) {
            parts.push({ type: "Literal", value: litBuf, text: src.slice(litStart, btStart) });
            litBuf = "";
          }
          parts.push(this._resultPart);
          litStart = pos;
        }
        continue;
      }
      text += src[pos];
      if (bp)
        litBuf += src[pos];
      pos++;
    }
    if (bp && litBuf)
      parts.push({ type: "Literal", value: litBuf, text: src.slice(litStart, pos) });
    this.pos = pos;
    this._wordText = text;
    this._wordQuoted = false;
    this._wordHasExpansions = false;
    if (bp) {
      this._wordParts = parts.length > 1 || parts.length === 1 && parts[0].type !== "Literal" ? parts : null;
    }
  }
  parseSubFieldWord(s) {
    if (!s)
      return new WordImpl("", 0, 0);
    const savedSrc = this.src;
    const savedPos = this.pos;
    const savedText = this._wordText;
    const savedParts = this._wordParts;
    const savedQuoted = this._wordQuoted;
    this.src = s;
    this.pos = 0;
    this.readInnerWordText();
    const word = new WordImpl(this._wordText, 0, 0);
    if (this._buildParts && this._wordParts) {
      word.parts = this._wordParts;
    }
    this.src = savedSrc;
    this.pos = savedPos;
    this._wordText = savedText;
    this._wordParts = savedParts;
    this._wordQuoted = savedQuoted;
    return word;
  }
  skipSQ() {
    while (this.pos < this.src.length && this.src.charCodeAt(this.pos) !== CH_SQUOTE)
      this.pos++;
    if (this.pos < this.src.length)
      this.pos++;
  }
  skipDQ() {
    const src = this.src;
    const len = src.length;
    while (this.pos < len) {
      const ch = src.charCodeAt(this.pos);
      if (ch === CH_DQUOTE) {
        this.pos++;
        return;
      }
      if (ch === CH_BACKSLASH) {
        this.pos += 2;
        continue;
      }
      if (ch === CH_DOLLAR && this.pos + 1 < len) {
        const next = src.charCodeAt(this.pos + 1);
        if (next === CH_LPAREN) {
          this.pos += 2;
          this.extractBalanced();
          continue;
        }
        if (next === CH_LBRACE) {
          this.pos += 2;
          let d = 1;
          while (this.pos < len && d > 0) {
            const c = src.charCodeAt(this.pos);
            if (c === CH_RBRACE) {
              if (--d === 0) {
                this.pos++;
                break;
              }
            } else if (c === CH_LBRACE && this.pos > 0 && src.charCodeAt(this.pos - 1) === CH_DOLLAR)
              d++;
            else if (c === CH_BACKSLASH) {
              this.pos++;
            } else if (c === CH_SQUOTE) {
              this.pos++;
              this.skipSQ();
              continue;
            } else if (c === CH_DQUOTE) {
              this.pos++;
              this.skipDQ();
              continue;
            }
            this.pos++;
          }
          continue;
        }
      }
      if (ch === CH_BACKTICK) {
        this.pos++;
        while (this.pos < len && src.charCodeAt(this.pos) !== CH_BACKTICK) {
          if (src.charCodeAt(this.pos) === CH_BACKSLASH)
            this.pos++;
          this.pos++;
        }
        if (this.pos < len)
          this.pos++;
        continue;
      }
      this.pos++;
    }
  }
  skipSpacesAndTabs() {
    const src = this.src;
    const len = src.length;
    while (this.pos < len) {
      const ch = src.charCodeAt(this.pos);
      if (ch === CH_SPACE || ch === CH_TAB)
        this.pos++;
      else if (ch === CH_BACKSLASH && this.pos + 1 < len && src.charCodeAt(this.pos + 1) === CH_NL)
        this.pos += 2;
      else
        break;
    }
  }
  readDoubleQuoted() {
    const src = this.src;
    const len = src.length;
    const contentStart = this.pos;
    let hasExpansions = false;
    const bp = this._buildParts;
    if (!bp) {
      let p = this.pos;
      while (p < len) {
        const c = src.charCodeAt(p);
        if (c === CH_DQUOTE) {
          this._dqText = src.slice(contentStart, p);
          this.pos = p + 1;
          this._dqHasExpansions = false;
          this._dqParts = null;
          return;
        }
        if (c === CH_DOLLAR || c === CH_BACKTICK || c === CH_BACKSLASH)
          break;
        p++;
      }
    }
    let text = "";
    let parts = null;
    let litBuf = "";
    let litStart = bp ? this.pos : 0;
    while (this.pos < len && src.charCodeAt(this.pos) !== CH_DQUOTE) {
      const runStart = this.pos;
      while (this.pos < len) {
        const c = src.charCodeAt(this.pos);
        if (c === CH_DQUOTE || c === CH_BACKSLASH || c === CH_DOLLAR || c === CH_BACKTICK)
          break;
        this.pos++;
      }
      if (this.pos > runStart) {
        const chunk = src.slice(runStart, this.pos);
        text += chunk;
        if (bp)
          litBuf += chunk;
      }
      if (this.pos >= len || src.charCodeAt(this.pos) === CH_DQUOTE)
        break;
      const ch = src.charCodeAt(this.pos);
      if (ch === CH_BACKSLASH) {
        this.pos++;
        if (this.pos < len) {
          const next = src.charCodeAt(this.pos);
          if (next === CH_NL) {
            this.pos++;
            continue;
          }
          if (next === CH_DOLLAR || next === CH_BACKTICK || next === CH_DQUOTE || next === CH_BACKSLASH) {
            const c = src[this.pos];
            text += c;
            if (bp)
              litBuf += c;
          } else {
            const pair = "\\" + src[this.pos];
            text += pair;
            if (bp)
              litBuf += pair;
          }
          this.pos++;
        }
        continue;
      }
      if (ch === CH_DOLLAR) {
        if (this.pos + 1 < len && src.charCodeAt(this.pos + 1) === CH_DQUOTE) {
          text += "$";
          if (bp)
            litBuf += "$";
          this.pos++;
          continue;
        }
        const expStart = this.pos;
        this.readDollar();
        text += this._resultText;
        if (this._resultHasExpansion)
          hasExpansions = true;
        if (bp) {
          const rp = this._resultPart;
          if (rp && isDQChild(rp)) {
            if (!parts)
              parts = [];
            if (litBuf) {
              parts.push({ type: "Literal", value: litBuf, text: src.slice(litStart, expStart) });
              litBuf = "";
            }
            parts.push(rp);
            litStart = this.pos;
          } else {
            litBuf += this._resultText;
          }
        }
        continue;
      }
      if (ch === CH_BACKTICK) {
        const btStart = this.pos;
        this.readBacktickExpansion();
        text += this._resultText;
        hasExpansions = true;
        if (bp && this._resultPart && isDQChild(this._resultPart)) {
          if (!parts)
            parts = [];
          if (litBuf) {
            parts.push({ type: "Literal", value: litBuf, text: src.slice(litStart, btStart) });
            litBuf = "";
          }
          parts.push(this._resultPart);
          litStart = this.pos;
        }
        continue;
      }
    }
    if (bp && parts && litBuf)
      parts.push({ type: "Literal", value: litBuf, text: src.slice(litStart, this.pos) });
    if (this.pos < len)
      this.pos++;
    else
      this.errors.push({ message: "unterminated double quote", pos: contentStart - 1 });
    this._dqText = text;
    this._dqHasExpansions = hasExpansions;
    this._dqParts = parts;
  }
  readDollar() {
    const dollarPos = this.pos;
    this.pos++;
    const src = this.src;
    const len = src.length;
    if (this.pos >= len) {
      this._resultText = "$";
      this._resultHasExpansion = false;
      this._resultPart = void 0;
      return;
    }
    const ch = src.charCodeAt(this.pos);
    if (ch === CH_LPAREN) {
      if (this.pos + 1 < len && src.charCodeAt(this.pos + 1) === CH_LPAREN) {
        this.readArithmeticExpansion();
        return;
      }
      this.readCommandSubstitution();
      return;
    }
    if (ch === CH_LBRACE) {
      const after = this.pos + 1 < len ? src.charCodeAt(this.pos + 1) : 0;
      if (after === CH_SPACE || after === CH_TAB || after === CH_NL) {
        this.readBraceCommandSubstitution();
        return;
      }
      if (after === CH_PIPE) {
        this.readValueSubstitution();
        return;
      }
      this.readParameterExpansion();
      return;
    }
    if (ch === CH_SQUOTE) {
      this.pos++;
      const value = this.readAnsiCQuoted();
      this._resultText = value;
      this._resultHasExpansion = false;
      this._resultPart = this._buildParts ? { type: "AnsiCQuoted", text: src.slice(dollarPos, this.pos), value } : void 0;
      return;
    }
    if (ch === CH_DQUOTE) {
      this.pos++;
      this.readDoubleQuoted();
      this._resultText = this._dqText;
      this._resultHasExpansion = this._dqHasExpansions;
      if (this._buildParts) {
        const text = src.slice(dollarPos, this.pos);
        this._resultPart = {
          type: "LocaleString",
          text,
          parts: this._dqParts ?? [
            { type: "Literal", value: this._dqText, text: src.slice(dollarPos + 2, this.pos - 1) }
          ]
        };
      } else {
        this._resultPart = void 0;
      }
      return;
    }
    if (ch === CH_AT || ch === CH_STAR || ch === CH_HASH || ch === CH_QUESTION || ch === CH_DASH || ch === CH_DOLLAR || ch === CH_BANG) {
      this.pos++;
      const text = src.slice(this.pos - 2, this.pos);
      this._resultText = text;
      this._resultHasExpansion = false;
      this._resultPart = this._buildParts ? { type: "SimpleExpansion", text } : void 0;
      return;
    }
    if (ch >= CH_0 && ch <= CH_9) {
      this.pos++;
      const text = src.slice(this.pos - 2, this.pos);
      this._resultText = text;
      this._resultHasExpansion = false;
      this._resultPart = this._buildParts ? { type: "SimpleExpansion", text } : void 0;
      return;
    }
    if (ch < 128 && isIdChar[ch] & 1) {
      const dollarPos2 = this.pos - 1;
      while (this.pos < len) {
        const c = src.charCodeAt(this.pos);
        if (c < 128 && isIdChar[c] & 2)
          this.pos++;
        else
          break;
      }
      const text = src.slice(dollarPos2, this.pos);
      this._resultText = text;
      this._resultHasExpansion = false;
      this._resultPart = this._buildParts ? { type: "SimpleExpansion", text } : void 0;
      return;
    }
    this._resultText = "$";
    this._resultHasExpansion = false;
    this._resultPart = void 0;
  }
  scanArithmeticBody() {
    this.pos += 2;
    let depth = 1;
    const src = this.src;
    const len = src.length;
    const start = this.pos;
    while (this.pos < len && depth > 0) {
      const c = src.charCodeAt(this.pos);
      if (c === CH_LPAREN && this.pos + 1 < len && src.charCodeAt(this.pos + 1) === CH_LPAREN) {
        depth++;
        this.pos += 2;
      } else if (c === CH_RPAREN && this.pos + 1 < len && src.charCodeAt(this.pos + 1) === CH_RPAREN) {
        if (--depth === 0) {
          this.pos += 2;
          break;
        }
        this.pos += 2;
      } else {
        this.pos++;
      }
    }
    return src.slice(start, this.pos - 2);
  }
  readArithmeticExpansion() {
    const body = this.scanArithmeticBody();
    const text = "$((" + body + "))";
    this._resultText = text;
    this._resultHasExpansion = false;
    if (this._buildParts) {
      const expr = parseArithmeticExpression(body) ?? void 0;
      this._resultPart = { type: "ArithmeticExpansion", text, expression: expr };
    } else {
      this._resultPart = void 0;
    }
  }
  readArithmeticCommand(out, tokenStart) {
    const body = this.scanArithmeticBody();
    setToken(out, Token.ArithCmd, body, tokenStart, this.pos);
  }
  readCommandSubstitution() {
    const dollarPos = this.pos - 1;
    this.pos++;
    this.extractBalanced();
    const text = this.src.slice(dollarPos, this.pos);
    this._resultText = text;
    this._resultHasExpansion = true;
    if (this._buildParts) {
      const inner = text.slice(2, -1);
      this._resultPart = { type: "CommandExpansion", text, script: void 0, inner };
      this.collectedExpansions.push({ inner, _part: this._resultPart });
    } else {
      this._resultPart = void 0;
    }
  }
  readBraceCommandSubstitution() {
    this.readBraceSubstitution("${ ", 1);
  }
  readValueSubstitution() {
    this.readBraceSubstitution("${| ", 2);
  }
  readBraceSubstitution(prefix, skip) {
    this.pos += skip;
    const src = this.src;
    const len = src.length;
    let depth = 1;
    const start = this.pos;
    while (this.pos < len) {
      const c = src.charCodeAt(this.pos);
      if (c === CH_LBRACE)
        depth++;
      else if (c === CH_RBRACE) {
        if (--depth === 0) {
          this.pos++;
          break;
        }
      } else if (c === CH_SQUOTE) {
        this.pos++;
        this.skipSQ();
        continue;
      } else if (c === CH_DQUOTE) {
        this.pos++;
        this.skipDQ();
        continue;
      } else if (c === CH_BACKSLASH)
        this.pos++;
      this.pos++;
    }
    const inner = src.slice(start, this.pos - 1).trim();
    const text = prefix + inner + " }";
    this._resultText = text;
    this._resultHasExpansion = true;
    if (this._buildParts) {
      this._resultPart = { type: "CommandExpansion", text, script: void 0, inner };
      this.collectedExpansions.push({ inner, _part: this._resultPart });
    } else {
      this._resultPart = void 0;
    }
  }
  readBacktickExpansion() {
    this.pos++;
    const src = this.src;
    const len = src.length;
    let inner = "";
    const start = this.pos;
    let hasEscapes = false;
    while (this.pos < len && src.charCodeAt(this.pos) !== CH_BACKTICK) {
      if (src.charCodeAt(this.pos) === CH_BACKSLASH) {
        hasEscapes = true;
        break;
      }
      this.pos++;
    }
    if (!hasEscapes) {
      inner = src.slice(start, this.pos);
    } else {
      inner = src.slice(start, this.pos);
      while (this.pos < len && src.charCodeAt(this.pos) !== CH_BACKTICK) {
        if (src.charCodeAt(this.pos) === CH_BACKSLASH) {
          this.pos++;
          if (this.pos < len) {
            const c = src.charCodeAt(this.pos);
            if (c === CH_DOLLAR || c === CH_BACKTICK || c === CH_BACKSLASH) {
              inner += src[this.pos];
            } else {
              inner += "\\" + src[this.pos];
            }
            this.pos++;
          }
        } else {
          const runStart = this.pos;
          while (this.pos < len) {
            const c = src.charCodeAt(this.pos);
            if (c === CH_BACKTICK || c === CH_BACKSLASH)
              break;
            this.pos++;
          }
          inner += src.slice(runStart, this.pos);
        }
      }
    }
    if (this.pos < len)
      this.pos++;
    else
      this.errors.push({ message: "unterminated backtick", pos: start - 1 });
    const text = src.slice(start - 1, this.pos);
    this._resultText = inner;
    this._resultHasExpansion = true;
    if (this._buildParts) {
      this._resultPart = { type: "CommandExpansion", text, script: void 0, inner };
      this.collectedExpansions.push({ inner, _part: this._resultPart });
    } else {
      this._resultPart = void 0;
    }
  }
  readParameterExpansion() {
    const src = this.src;
    const len = src.length;
    const start = this.pos;
    this.pos++;
    let depth = 1;
    while (this.pos < len && depth > 0) {
      const ch = src.charCodeAt(this.pos);
      if (ch === CH_LBRACE && this.pos > 0 && src.charCodeAt(this.pos - 1) === CH_DOLLAR)
        depth++;
      else if (ch === CH_RBRACE) {
        if (--depth === 0) {
          this.pos++;
          break;
        }
      } else if (ch === CH_BACKSLASH) {
        this.pos++;
      } else if (ch === CH_SQUOTE) {
        this.pos++;
        this.skipSQ();
        continue;
      } else if (ch === CH_DQUOTE) {
        this.pos++;
        this.skipDQ();
        continue;
      }
      this.pos++;
    }
    const text = src.slice(start - 1, this.pos);
    this._resultText = text;
    this._resultHasExpansion = false;
    if (this._buildParts) {
      const inner = src.slice(start + 1, this.pos - 1);
      this._resultPart = this.parseParamInner(text, inner);
    } else {
      this._resultPart = void 0;
    }
  }
  parseParamInner(text, inner) {
    const result = {
      type: "ParameterExpansion",
      text,
      parameter: "",
      index: void 0,
      indirect: void 0,
      length: void 0,
      operator: void 0,
      operand: void 0,
      slice: void 0,
      replace: void 0
    };
    const ilen = inner.length;
    if (ilen === 0)
      return result;
    let i = 0;
    if (inner.charCodeAt(0) === CH_BANG) {
      result.indirect = true;
      i = 1;
    }
    if (!result.indirect && inner.charCodeAt(0) === CH_HASH) {
      if (ilen === 1) {
        result.parameter = "#";
        return result;
      }
      if (inner.charCodeAt(1) === CH_HASH) {
        result.parameter = "#";
        i = 1;
      } else {
        const tryI = this.scanParamName(inner, 1);
        if (tryI > 1) {
          let endI = tryI;
          if (endI < ilen && inner.charCodeAt(endI) === CH_LBRACKET) {
            const closeB = this.findCloseBracket(inner, endI + 1);
            if (closeB !== -1)
              endI = closeB + 1;
          }
          if (endI >= ilen) {
            result.length = true;
            result.parameter = inner.slice(1, tryI);
            if (tryI < ilen && inner.charCodeAt(tryI) === CH_LBRACKET) {
              const closeB = this.findCloseBracket(inner, tryI + 1);
              if (closeB !== -1)
                result.index = inner.slice(tryI + 1, closeB);
            }
            return result;
          }
        }
        result.parameter = "#";
        i = 1;
      }
    }
    if (!result.parameter) {
      const nameStart = i;
      i = this.scanParamName(inner, i);
      result.parameter = inner.slice(nameStart, i);
    }
    if (i < ilen && inner.charCodeAt(i) === CH_LBRACKET) {
      const closeB = this.findCloseBracket(inner, i + 1);
      if (closeB !== -1) {
        result.index = inner.slice(i + 1, closeB);
        i = closeB + 1;
      }
    }
    if (i >= ilen)
      return result;
    const opChar = inner.charCodeAt(i);
    if (opChar === CH_COLON) {
      if (i + 1 < ilen) {
        const nc = inner.charCodeAt(i + 1);
        if (nc === CH_DASH || nc === CH_EQ || nc === CH_PLUS || nc === CH_QUESTION) {
          result.operator = inner.slice(i, i + 2);
          result.operand = this.parseSubFieldWord(inner.slice(i + 2));
          return result;
        }
      }
      i++;
      const sliceRest = inner.slice(i);
      const colonIdx = findUnnested(sliceRest, CH_COLON);
      if (colonIdx === -1) {
        result.slice = { offset: this.parseSubFieldWord(sliceRest), length: void 0 };
      } else {
        result.slice = {
          offset: this.parseSubFieldWord(sliceRest.slice(0, colonIdx)),
          length: this.parseSubFieldWord(sliceRest.slice(colonIdx + 1))
        };
      }
      return result;
    }
    if (opChar === CH_DASH || opChar === CH_EQ || opChar === CH_PLUS || opChar === CH_QUESTION) {
      result.operator = inner[i];
      result.operand = this.parseSubFieldWord(inner.slice(i + 1));
      return result;
    }
    if (opChar === CH_HASH) {
      if (i + 1 < ilen && inner.charCodeAt(i + 1) === CH_HASH) {
        result.operator = "##";
        result.operand = this.parseSubFieldWord(inner.slice(i + 2));
      } else {
        result.operator = "#";
        result.operand = this.parseSubFieldWord(inner.slice(i + 1));
      }
      return result;
    }
    if (opChar === CH_PERCENT) {
      if (i + 1 < ilen && inner.charCodeAt(i + 1) === CH_PERCENT) {
        result.operator = "%%";
        result.operand = this.parseSubFieldWord(inner.slice(i + 2));
      } else {
        result.operator = "%";
        result.operand = this.parseSubFieldWord(inner.slice(i + 1));
      }
      return result;
    }
    if (opChar === CH_SLASH) {
      i++;
      let replOp = "/";
      if (i < ilen) {
        const nc = inner.charCodeAt(i);
        if (nc === CH_SLASH) {
          replOp = "//";
          i++;
        } else if (nc === CH_HASH) {
          replOp = "/#";
          i++;
        } else if (nc === CH_PERCENT) {
          replOp = "/%";
          i++;
        }
      }
      result.operator = replOp;
      const rest = inner.slice(i);
      const sepIdx = findUnnested(rest, CH_SLASH);
      if (sepIdx === -1) {
        result.replace = {
          pattern: this.parseSubFieldWord(rest),
          replacement: new WordImpl("", 0, 0)
        };
      } else {
        result.replace = {
          pattern: this.parseSubFieldWord(rest.slice(0, sepIdx)),
          replacement: this.parseSubFieldWord(rest.slice(sepIdx + 1))
        };
      }
      return result;
    }
    if (opChar === CH_CARET) {
      if (i + 1 < ilen && inner.charCodeAt(i + 1) === CH_CARET) {
        result.operator = "^^";
        const rest = inner.slice(i + 2);
        if (rest)
          result.operand = this.parseSubFieldWord(rest);
      } else {
        result.operator = "^";
        const rest = inner.slice(i + 1);
        if (rest)
          result.operand = this.parseSubFieldWord(rest);
      }
      return result;
    }
    if (opChar === CH_COMMA) {
      if (i + 1 < ilen && inner.charCodeAt(i + 1) === CH_COMMA) {
        result.operator = ",,";
        const rest = inner.slice(i + 2);
        if (rest)
          result.operand = this.parseSubFieldWord(rest);
      } else {
        result.operator = ",";
        const rest = inner.slice(i + 1);
        if (rest)
          result.operand = this.parseSubFieldWord(rest);
      }
      return result;
    }
    if (opChar === CH_AT) {
      result.operator = "@";
      result.operand = this.parseSubFieldWord(inner.slice(i + 1));
      return result;
    }
    result.operator = inner.slice(i);
    return result;
  }
  scanParamName(s, start) {
    let i = start;
    if (i >= s.length)
      return i;
    const c = s.charCodeAt(i);
    if (c === CH_AT || c === CH_STAR || c === CH_HASH || c === CH_QUESTION || c === CH_DASH || c === CH_DOLLAR || c === CH_BANG) {
      return i + 1;
    }
    if (c >= CH_0 && c <= CH_9) {
      while (i < s.length && s.charCodeAt(i) >= CH_0 && s.charCodeAt(i) <= CH_9)
        i++;
      return i;
    }
    if (c >= CH_a && c <= CH_z || c >= CH_A && c <= CH_Z || c === CH_UNDERSCORE) {
      i++;
      while (i < s.length) {
        const ch = s.charCodeAt(i);
        if (ch >= CH_a && ch <= CH_z || ch >= CH_A && ch <= CH_Z || ch >= CH_0 && ch <= CH_9 || ch === CH_UNDERSCORE)
          i++;
        else
          break;
      }
    }
    return i;
  }
  findCloseBracket(s, start) {
    let depth = 1;
    for (let i = start; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c === CH_LBRACKET)
        depth++;
      else if (c === CH_RBRACKET) {
        if (--depth === 0)
          return i;
      }
    }
    return -1;
  }
  readAnsiCQuoted() {
    const src = this.src;
    const len = src.length;
    let text = "";
    while (this.pos < len && src.charCodeAt(this.pos) !== CH_SQUOTE) {
      if (src.charCodeAt(this.pos) === CH_BACKSLASH && this.pos + 1 < len) {
        this.pos++;
        const ch = src[this.pos];
        switch (ch) {
          case "n":
            text += "\n";
            break;
          case "t":
            text += "	";
            break;
          case "r":
            text += "\r";
            break;
          case "\\":
            text += "\\";
            break;
          case "'":
            text += "'";
            break;
          case '"':
            text += '"';
            break;
          case "a":
            text += "\x07";
            break;
          case "b":
            text += "\b";
            break;
          case "e":
          case "E":
            text += "\x1B";
            break;
          case "f":
            text += "\f";
            break;
          case "v":
            text += "\v";
            break;
          default:
            text += "\\" + ch;
            break;
        }
        this.pos++;
      } else {
        const runStart = this.pos;
        while (this.pos < len) {
          const c = src.charCodeAt(this.pos);
          if (c === CH_SQUOTE || c === CH_BACKSLASH)
            break;
          this.pos++;
        }
        text += src.slice(runStart, this.pos);
      }
    }
    if (this.pos < len)
      this.pos++;
    return text;
  }
  // Extract balanced parens for $(...) — respects nested quotes and case..esac
  extractBalanced() {
    const src = this.src;
    const len = src.length;
    let depth = 1;
    const start = this.pos;
    while (this.pos < len && depth > 0) {
      const c = src.charCodeAt(this.pos);
      if (c === CH_RPAREN) {
        depth--;
        if (depth === 0) {
          const result = src.slice(start, this.pos);
          this.pos++;
          return result;
        }
        this.pos++;
      } else if (c === CH_LPAREN || c === CH_BACKSLASH || c === CH_SQUOTE || c === CH_DQUOTE || c === CH_BACKTICK) {
        break;
      } else if (c === 99 && // Ensure word start boundary (not inside e.g. "lowercase")
      (this.pos === start || src.charCodeAt(this.pos - 1) < 128 && charType[src.charCodeAt(this.pos - 1)] !== 0) && this.pos + 3 < len && src.charCodeAt(this.pos + 1) === 97 && src.charCodeAt(this.pos + 2) === 115 && src.charCodeAt(this.pos + 3) === 101 && (this.pos + 4 >= len || src.charCodeAt(this.pos + 4) < 128 && charType[src.charCodeAt(this.pos + 4)] & 1)) {
        break;
      } else {
        this.pos++;
      }
    }
    if (depth === 0)
      return src.slice(start, this.pos);
    let caseDepth = 0;
    while (this.pos < len && depth > 0) {
      const ch = src.charCodeAt(this.pos);
      if (ch === CH_LPAREN) {
        depth++;
        this.pos++;
      } else if (ch === CH_RPAREN) {
        if (caseDepth > 0) {
          this.pos++;
        } else {
          depth--;
          if (depth === 0) {
            const result = src.slice(start, this.pos);
            this.pos++;
            return result;
          }
          this.pos++;
        }
      } else if (ch === CH_BACKSLASH) {
        this.pos++;
        if (this.pos < len)
          this.pos++;
      } else if (ch === CH_SQUOTE) {
        this.pos++;
        this.skipSQ();
      } else if (ch === CH_DQUOTE) {
        this.pos++;
        this.skipDQ();
      } else if (ch === CH_BACKTICK) {
        this.pos++;
        while (this.pos < len && src.charCodeAt(this.pos) !== CH_BACKTICK) {
          if (src.charCodeAt(this.pos) === CH_BACKSLASH)
            this.pos++;
          if (this.pos < len)
            this.pos++;
        }
        if (this.pos < len)
          this.pos++;
      } else {
        const wStart = this.pos;
        while (this.pos < len) {
          const wc = src.charCodeAt(this.pos);
          if (wc < 128 && charType[wc])
            break;
          this.pos++;
        }
        if (this.pos > wStart) {
          const wLen = this.pos - wStart;
          if (wLen === 4) {
            const c0 = src.charCodeAt(wStart);
            if (c0 === 99 && src.charCodeAt(wStart + 1) === 97 && src.charCodeAt(wStart + 2) === 115 && src.charCodeAt(wStart + 3) === 101) {
              caseDepth++;
            } else if (c0 === 101 && src.charCodeAt(wStart + 1) === 115 && src.charCodeAt(wStart + 2) === 97 && src.charCodeAt(wStart + 3) === 99 && caseDepth > 0) {
              caseDepth--;
            }
          }
        } else {
          this.pos++;
        }
      }
    }
    return src.slice(start, this.pos);
  }
};

// node_modules/.pnpm/unbash@2.2.0/node_modules/unbash/dist/parts.js
function computeWordParts(source, word) {
  const lexer = new Lexer(source);
  let parts;
  if (word.text.includes("\n") && word.pos > 0) {
    parts = lexer.buildHereDocParts(word.pos, word.end);
  } else {
    parts = lexer.buildWordParts(word.pos);
  }
  if (!parts)
    return void 0;
  for (const exp of lexer.getCollectedExpansions()) {
    resolveExpansion(exp);
  }
  return parts;
}
function resolveExpansion(e) {
  if (e.inner !== void 0 && e._part) {
    e._part.script = parse(e.inner);
    e._part.inner = void 0;
    e._part = void 0;
    e.inner = void 0;
  }
}

// node_modules/.pnpm/unbash@2.2.0/node_modules/unbash/dist/parser.js
WordImpl._resolve = computeWordParts;
var ArithmeticCommandImpl = class {
  type = "ArithmeticCommand";
  pos;
  end;
  body;
  #expression = null;
  constructor(pos, end, body) {
    this.pos = pos;
    this.end = end;
    this.body = body;
  }
  get expression() {
    if (this.#expression === null) {
      this.#expression = parseArithmeticExpression(this.body, this.pos + 2) ?? void 0;
    }
    return this.#expression;
  }
  set expression(v) {
    this.#expression = v ?? void 0;
  }
};
var ArithmeticForImpl = class {
  type = "ArithmeticFor";
  pos;
  end;
  body;
  #initStr;
  #testStr;
  #updateStr;
  #initPos;
  #testPos;
  #updatePos;
  #initialize = null;
  #test = null;
  #update = null;
  constructor(pos, end, body, initStr, testStr, updateStr, initPos, testPos, updatePos) {
    this.pos = pos;
    this.end = end;
    this.body = body;
    this.#initStr = initStr;
    this.#testStr = testStr;
    this.#updateStr = updateStr;
    this.#initPos = initPos;
    this.#testPos = testPos;
    this.#updatePos = updatePos;
  }
  get initialize() {
    if (this.#initialize === null) {
      if (this.#initStr) {
        const expr = parseArithmeticExpression(this.#initStr);
        if (expr)
          offsetArith(expr, this.#initPos);
        this.#initialize = expr ?? void 0;
      } else {
        this.#initialize = void 0;
      }
    }
    return this.#initialize;
  }
  set initialize(v) {
    this.#initialize = v ?? void 0;
  }
  get test() {
    if (this.#test === null) {
      if (this.#testStr) {
        const expr = parseArithmeticExpression(this.#testStr);
        if (expr)
          offsetArith(expr, this.#testPos);
        this.#test = expr ?? void 0;
      } else {
        this.#test = void 0;
      }
    }
    return this.#test;
  }
  set test(v) {
    this.#test = v ?? void 0;
  }
  get update() {
    if (this.#update === null) {
      if (this.#updateStr) {
        const expr = parseArithmeticExpression(this.#updateStr);
        if (expr)
          offsetArith(expr, this.#updatePos);
        this.#update = expr ?? void 0;
      } else {
        this.#update = void 0;
      }
    }
    return this.#update;
  }
  set update(v) {
    this.#update = v ?? void 0;
  }
};
var CASE_TERMINATORS = {
  [Token.DoubleSemi]: ";;",
  [Token.SemiAmp]: ";&",
  [Token.DoubleSemiAmp]: ";;&"
};
var REDIRECT_OPS = {
  ">": ">",
  ">>": ">>",
  "<": "<",
  "<<": "<<",
  "<<-": "<<-",
  "<<<": "<<<",
  "<>": "<>",
  "<&": "<&",
  ">&": ">&",
  ">|": ">|",
  "&>": "&>",
  "&>>": "&>>"
};
function offsetArith(node, base) {
  node.pos += base;
  node.end += base;
  switch (node.type) {
    case "ArithmeticBinary":
      offsetArith(node.left, base);
      offsetArith(node.right, base);
      break;
    case "ArithmeticUnary":
      offsetArith(node.operand, base);
      break;
    case "ArithmeticTernary":
      offsetArith(node.test, base);
      offsetArith(node.consequent, base);
      offsetArith(node.alternate, base);
      break;
    case "ArithmeticGroup":
      offsetArith(node.expression, base);
      break;
  }
}
var listTerminators = new Uint8Array(37);
listTerminators[Token.EOF] = 1;
listTerminators[Token.RParen] = 1;
listTerminators[Token.RBrace] = 1;
listTerminators[Token.Then] = 1;
listTerminators[Token.Else] = 1;
listTerminators[Token.Elif] = 1;
listTerminators[Token.Fi] = 1;
listTerminators[Token.Do] = 1;
listTerminators[Token.Done] = 1;
listTerminators[Token.Esac] = 1;
listTerminators[Token.DoubleSemi] = 1;
listTerminators[Token.SemiAmp] = 1;
listTerminators[Token.DoubleSemiAmp] = 1;
var commandStarts = new Uint8Array(37);
commandStarts[Token.Word] = 1;
commandStarts[Token.Assignment] = 1;
commandStarts[Token.Bang] = 1;
commandStarts[Token.LParen] = 1;
commandStarts[Token.LBrace] = 1;
commandStarts[Token.DblLBracket] = 1;
commandStarts[Token.If] = 1;
commandStarts[Token.For] = 1;
commandStarts[Token.While] = 1;
commandStarts[Token.Until] = 1;
commandStarts[Token.Case] = 1;
commandStarts[Token.Function] = 1;
commandStarts[Token.Select] = 1;
commandStarts[Token.ArithCmd] = 1;
commandStarts[Token.Coproc] = 1;
commandStarts[Token.Redirect] = 1;
var UNARY_TEST_OPS = {
  "-a": 1,
  "-b": 1,
  "-c": 1,
  "-d": 1,
  "-e": 1,
  "-f": 1,
  "-g": 1,
  "-h": 1,
  "-k": 1,
  "-p": 1,
  "-r": 1,
  "-s": 1,
  "-t": 1,
  "-u": 1,
  "-v": 1,
  "-w": 1,
  "-x": 1,
  "-z": 1,
  "-n": 1,
  "-N": 1,
  "-S": 1,
  "-L": 1,
  "-G": 1,
  "-O": 1,
  "-R": 1
};
var BINARY_TEST_OPS = {
  "==": 1,
  "!=": 1,
  "=~": 1,
  "=": 1,
  "-eq": 1,
  "-ne": 1,
  "-lt": 1,
  "-le": 1,
  "-gt": 1,
  "-ge": 1,
  "-nt": 1,
  "-ot": 1,
  "-ef": 1,
  "<": 1,
  ">": 1
};
var EMPTY_PREFIX = [];
var EMPTY_SUFFIX = [];
var EMPTY_REDIRECTS = [];
function parse(source) {
  const parser = new Parser(source);
  return parser.parse(source.length);
}
var Parser = class {
  tok;
  source;
  errors = [];
  _redirects = [];
  constructor(source) {
    this.tok = new Lexer(source);
    this.source = source;
  }
  parse(sourceLen) {
    let shebang;
    if (this.source.charCodeAt(0) === 35 && this.source.charCodeAt(1) === 33) {
      const nl = this.source.indexOf("\n");
      shebang = nl === -1 ? this.source : this.source.slice(0, nl);
    }
    const commands = this.list();
    const lexerErrors = this.tok._errors;
    if (lexerErrors !== null) {
      for (let i = 0; i < lexerErrors.length; i++)
        this.errors.push(lexerErrors[i]);
    }
    const result = {
      type: "Script",
      pos: 0,
      end: sourceLen,
      shebang,
      commands,
      errors: this.errors.length > 0 ? this.errors : void 0
    };
    return result;
  }
  error(message, pos) {
    this.errors.push({ message, pos });
  }
  skipSemi() {
    if (this.tok.peek(LexContext.Normal).token === Token.Semi)
      this.tok.next(LexContext.Normal);
  }
  accept(token, ctx = LexContext.Normal) {
    if (this.tok.peek(ctx).token === token)
      return this.tok.next(ctx);
    return null;
  }
  acceptEnd(token, ctx = LexContext.Normal) {
    if (this.tok.peek(ctx).token === token)
      return this.tok.next(ctx).end;
    return -1;
  }
  skipNewlines(ctx = LexContext.Normal) {
    while (this.tok.peek(ctx).token === Token.Newline)
      this.tok.next(ctx);
  }
  makeStatement(command, redirects) {
    const end = redirects.length > 0 ? redirects[redirects.length - 1].end : command.end;
    return {
      type: "Statement",
      pos: command.pos,
      end,
      command,
      background: void 0,
      redirects
    };
  }
  // list := and_or ((';' | '&' | NEWLINE) and_or)* [';' | '&' | NEWLINE]
  list() {
    const commands = [];
    this.skipNewlines(LexContext.CommandStart);
    let t = this.tok.peek(LexContext.CommandStart).token;
    if (listTerminators[t] || !commandStarts[t])
      return commands;
    const first = this.andOr();
    if (first) {
      const redirects = this._redirects;
      this._redirects = [];
      commands.push(this.makeStatement(first, redirects));
    }
    for (; ; ) {
      t = this.tok.peek(LexContext.Normal).token;
      if (t !== Token.Semi && t !== Token.Newline && t !== Token.Amp)
        break;
      const isBackground = t === Token.Amp;
      const sepEnd = this.tok.next(LexContext.Normal).end;
      if (isBackground) {
        const stmt = commands[commands.length - 1];
        stmt.background = true;
        stmt.end = sepEnd;
      }
      this.skipNewlines(LexContext.CommandStart);
      t = this.tok.peek(LexContext.CommandStart).token;
      if (listTerminators[t] || !commandStarts[t])
        break;
      const node = this.andOr();
      if (node) {
        const redirects = this._redirects;
        this._redirects = [];
        commands.push(this.makeStatement(node, redirects));
      }
    }
    return commands;
  }
  // and_or := pipeline (('&&' | '||') newlines pipeline)*
  andOr() {
    const first = this.pipeline();
    if (!first)
      return null;
    let t = this.tok.peek(LexContext.Normal).token;
    if (t !== Token.And && t !== Token.Or)
      return first;
    let wrappedFirst = first;
    if (this._redirects.length > 0) {
      wrappedFirst = this.makeStatement(first, this._redirects);
      this._redirects = [];
    }
    const commands = [wrappedFirst];
    const operators = [];
    do {
      operators.push(this.tok.next(LexContext.Normal).token === Token.And ? "&&" : "||");
      this.skipNewlines(LexContext.CommandStart);
      const next = this.pipeline();
      if (!next)
        break;
      commands.push(next);
      t = this.tok.peek(LexContext.Normal).token;
    } while (t === Token.And || t === Token.Or);
    return {
      type: "AndOr",
      pos: first.pos,
      end: commands[commands.length - 1].end,
      commands,
      operators
    };
  }
  wrapCompoundRedirects(node) {
    const redirects = this._redirects;
    this._redirects = [];
    if (redirects.length === 0)
      return node;
    return this.makeStatement(node, redirects);
  }
  // pipeline := ['time' ['-p']] ['!'] command ('|' newlines command)*
  pipeline() {
    let time = false;
    let pipelinePos = 0;
    if (this.tok.peek(LexContext.CommandStart).token === Token.Word && this.tok.peek(LexContext.CommandStart).value === "time") {
      time = true;
      pipelinePos = this.tok.next(LexContext.CommandStart).pos;
      if (this.tok.peek(LexContext.CommandStart).token === Token.Word && this.tok.peek(LexContext.CommandStart).value === "-p")
        this.tok.next(LexContext.CommandStart);
    }
    const negated = this.tok.peek(LexContext.CommandStart).token === Token.Bang;
    if (negated) {
      if (!time)
        pipelinePos = this.tok.peek(LexContext.CommandStart).pos;
      this.tok.next(LexContext.CommandStart);
    }
    const first = this.command();
    if (!first) {
      if (time || negated) {
        const pipeline2 = {
          type: "Pipeline",
          pos: pipelinePos,
          end: pipelinePos,
          commands: [],
          negated: negated ? true : void 0,
          operators: [],
          time: time ? true : void 0
        };
        return pipeline2;
      }
      return null;
    }
    if (!time && !negated)
      pipelinePos = first.pos;
    const commands = [first];
    const operators = [];
    let firstRedirects = this._redirects;
    this._redirects = [];
    while (this.tok.peek(LexContext.Normal).token === Token.Pipe) {
      if (commands.length === 1 && firstRedirects.length > 0) {
        commands[0] = this.makeStatement(first, firstRedirects);
        firstRedirects = [];
      }
      const pipeVal = this.tok.next(LexContext.Normal).value;
      operators.push(pipeVal === "|&" ? "|&" : "|");
      this.skipNewlines(LexContext.CommandStart);
      const cmd = this.command();
      if (cmd)
        commands.push(this.wrapCompoundRedirects(cmd));
    }
    if (commands.length === 1 && !negated && !time) {
      this._redirects = firstRedirects;
      return commands[0];
    }
    if (firstRedirects.length > 0) {
      commands[0] = this.makeStatement(first, firstRedirects);
    }
    const pipeline = {
      type: "Pipeline",
      pos: pipelinePos,
      end: commands[commands.length - 1].end,
      commands,
      negated: negated ? true : void 0,
      operators,
      time: time ? true : void 0
    };
    return pipeline;
  }
  // command := compound_command | function_def | simple_command
  command() {
    switch (this.tok.peek(LexContext.CommandStart).token) {
      case Token.LParen:
        return this.subshell();
      case Token.LBrace:
        return this.braceGroup();
      case Token.If:
        return this.ifClause();
      case Token.For:
        return this.forClause();
      case Token.While:
        return this.whileClause();
      case Token.Until:
        return this.untilClause();
      case Token.Case:
        return this.caseClause();
      case Token.Function:
        return this.functionDef();
      case Token.Select:
        return this.selectClause();
      case Token.DblLBracket:
        return this.testCommand();
      case Token.ArithCmd:
        return this.arithCommand();
      case Token.Coproc:
        return this.coprocCommand();
      case Token.Word:
      case Token.Assignment:
      case Token.Redirect:
        return this.simpleCommandOrFunction();
      default:
        return null;
    }
  }
  collectTrailingRedirects() {
    let redirects = [];
    while (this.tok.peek(LexContext.Normal).token === Token.Redirect) {
      redirects = this.collectRedirect(redirects, LexContext.Normal);
    }
    return redirects;
  }
  // arith_command := (( expr ))
  arithCommand() {
    const tok = this.tok.next(LexContext.CommandStart);
    this._redirects = this.collectTrailingRedirects();
    return new ArithmeticCommandImpl(tok.pos, tok.end, tok.value);
  }
  // coproc := COPROC [name] command [redirections]
  coprocCommand() {
    const startTok = this.tok.next(LexContext.CommandStart);
    const pos = startTok.pos;
    const startEnd = startTok.end;
    const t = this.tok.peek(LexContext.CommandStart);
    if (t.token !== Token.Word && t.token !== Token.Assignment && t.token !== Token.Redirect) {
      const body2 = this.pipeline() ?? {
        type: "Command",
        pos,
        end: startEnd,
        name: void 0,
        prefix: EMPTY_PREFIX,
        suffix: EMPTY_SUFFIX,
        redirects: EMPTY_REDIRECTS
      };
      const bodyRedirects2 = this._redirects;
      this._redirects = [];
      const redirects2 = this.collectTrailingRedirects();
      const allRedirects2 = [...bodyRedirects2, ...redirects2];
      const end2 = allRedirects2.length > 0 ? allRedirects2[allRedirects2.length - 1].end : body2.end;
      return { type: "Coproc", pos, end: end2, name: void 0, body: body2, redirects: allRedirects2 };
    }
    const tentativeWord = this.toWord(this.tok.next(LexContext.CommandStart));
    const body = this.pipeline();
    if (body === null) {
      const cmd = {
        type: "Command",
        pos: tentativeWord.pos,
        end: tentativeWord.end,
        name: tentativeWord,
        prefix: EMPTY_PREFIX,
        suffix: EMPTY_SUFFIX,
        redirects: EMPTY_REDIRECTS
      };
      const redirects2 = this.collectTrailingRedirects();
      const end2 = redirects2.length > 0 ? redirects2[redirects2.length - 1].end : cmd.end;
      return { type: "Coproc", pos, end: end2, name: void 0, body: cmd, redirects: redirects2 };
    }
    if (body.type === "Command") {
      const cmd = body;
      if (cmd.name) {
        cmd.suffix = [cmd.name, ...cmd.suffix];
      }
      cmd.name = tentativeWord;
      cmd.pos = tentativeWord.pos;
      const redirects2 = this.collectTrailingRedirects();
      const end2 = redirects2.length > 0 ? redirects2[redirects2.length - 1].end : cmd.end;
      return { type: "Coproc", pos, end: end2, name: void 0, body: cmd, redirects: redirects2 };
    }
    const bodyRedirects = this._redirects;
    this._redirects = [];
    const redirects = this.collectTrailingRedirects();
    const allRedirects = [...bodyRedirects, ...redirects];
    const end = allRedirects.length > 0 ? allRedirects[allRedirects.length - 1].end : body.end;
    return { type: "Coproc", pos, end, name: tentativeWord, body, redirects: allRedirects };
  }
  // subshell := '(' list ')'
  subshell() {
    const pos = this.tok.next(LexContext.CommandStart).pos;
    const commands = this.list();
    const closeEnd = this.acceptEnd(Token.RParen, LexContext.Normal);
    if (closeEnd < 0)
      this.error("expected ')' to close subshell", this.tok.getPos());
    const end = closeEnd >= 0 ? closeEnd : pos;
    this._redirects = this.collectTrailingRedirects();
    return { type: "Subshell", pos, end, body: this.makeCompoundList(commands) };
  }
  // brace_group := '{' list '}'
  braceGroup() {
    const pos = this.tok.next(LexContext.CommandStart).pos;
    const commands = this.list();
    const closeEnd = this.acceptEnd(Token.RBrace, LexContext.Normal);
    if (closeEnd < 0)
      this.error("expected '}' to close brace group", this.tok.getPos());
    const end = closeEnd >= 0 ? closeEnd : pos;
    this._redirects = this.collectTrailingRedirects();
    return { type: "BraceGroup", pos, end, body: this.makeCompoundList(commands) };
  }
  // if_clause := IF list THEN list (ELIF list THEN list)* [ELSE list] FI
  ifClause() {
    const pos = this.tok.next(LexContext.CommandStart).pos;
    const clause = this.makeCompoundList(this.list());
    this.skipSemi();
    if (!this.accept(Token.Then, LexContext.CommandStart))
      this.error("expected 'then'", this.tok.getPos());
    const then_ = this.makeCompoundList(this.list());
    this.skipSemi();
    let else_;
    let end;
    if (this.tok.peek(LexContext.CommandStart).token === Token.Elif) {
      else_ = this.ifClause();
      end = else_.end;
    } else if (this.accept(Token.Else, LexContext.CommandStart)) {
      else_ = this.makeCompoundList(this.list());
      this.skipSemi();
      const closeEnd = this.acceptEnd(Token.Fi, LexContext.CommandStart);
      if (closeEnd < 0)
        this.error("expected 'fi' to close 'if'", this.tok.getPos());
      end = closeEnd >= 0 ? closeEnd : pos;
    } else {
      const closeEnd = this.acceptEnd(Token.Fi, LexContext.CommandStart);
      if (closeEnd < 0)
        this.error("expected 'fi' to close 'if'", this.tok.getPos());
      end = closeEnd >= 0 ? closeEnd : pos;
    }
    this._redirects = this.collectTrailingRedirects();
    return { type: "If", pos, end, clause, then: then_, else: else_ };
  }
  // for_clause := FOR word [IN word* (';'|NL)] DO list DONE
  //            | FOR '((' expr '))' [';'|NL] DO list DONE
  forClause() {
    const pos = this.tok.next(LexContext.CommandStart).pos;
    if (this.tok.peek(LexContext.Normal).token === Token.LParen) {
      return this.cStyleFor(pos);
    }
    const name = this.readWord(LexContext.Normal);
    const wordlist = [];
    this.skipNewlines(LexContext.CommandStart);
    if (this.tok.peek(LexContext.CommandStart).token === Token.In) {
      this.tok.next(LexContext.CommandStart);
      while (this.tok.peek(LexContext.Normal).token === Token.Word) {
        wordlist.push(this.readWord(LexContext.Normal));
      }
    }
    this.skipSemi();
    this.skipNewlines(LexContext.CommandStart);
    if (!this.accept(Token.Do, LexContext.CommandStart))
      this.error("expected 'do'", this.tok.getPos());
    const body = this.list();
    this.skipSemi();
    const closeEnd = this.acceptEnd(Token.Done, LexContext.CommandStart);
    if (closeEnd < 0)
      this.error("expected 'done' to close 'for'", this.tok.getPos());
    const end = closeEnd >= 0 ? closeEnd : pos;
    this._redirects = this.collectTrailingRedirects();
    return { type: "For", pos, end, name, wordlist, body: this.makeCompoundList(body) };
  }
  // C-style for: (( expr; expr; expr )) [;|NL] do list done | { list }
  cStyleFor(pos) {
    const [initStr, testStr, updateStr, initPos, testPos, updatePos] = this.tok.readCStyleForExprs();
    if (this.tok.peek(LexContext.CommandStart).token === Token.Semi)
      this.tok.next(LexContext.CommandStart);
    this.skipNewlines(LexContext.CommandStart);
    if (this.tok.peek(LexContext.CommandStart).token === Token.LBrace) {
      const bg = this.braceGroup();
      return new ArithmeticForImpl(pos, bg.end, bg.body, initStr, testStr, updateStr, initPos, testPos, updatePos);
    }
    if (!this.accept(Token.Do, LexContext.CommandStart))
      this.error("expected 'do'", this.tok.getPos());
    const body = this.list();
    const closeEnd = this.acceptEnd(Token.Done, LexContext.CommandStart);
    if (closeEnd < 0)
      this.error("expected 'done' to close 'for'", this.tok.getPos());
    const end = closeEnd >= 0 ? closeEnd : pos;
    this._redirects = this.collectTrailingRedirects();
    return new ArithmeticForImpl(pos, end, this.makeCompoundList(body), initStr, testStr, updateStr, initPos, testPos, updatePos);
  }
  whileClause() {
    return this.whileOrUntil("while");
  }
  untilClause() {
    return this.whileOrUntil("until");
  }
  whileOrUntil(kind) {
    const pos = this.tok.next(LexContext.CommandStart).pos;
    const clause = this.makeCompoundList(this.list());
    this.skipSemi();
    if (!this.accept(Token.Do, LexContext.CommandStart))
      this.error("expected 'do'", this.tok.getPos());
    const body = this.list();
    this.skipSemi();
    const closeEnd = this.acceptEnd(Token.Done, LexContext.CommandStart);
    if (closeEnd < 0)
      this.error(`expected 'done' to close '${kind}'`, this.tok.getPos());
    const end = closeEnd >= 0 ? closeEnd : pos;
    this._redirects = this.collectTrailingRedirects();
    return { type: "While", pos, end, kind, clause, body: this.makeCompoundList(body) };
  }
  // case_clause := CASE word IN (pattern) list (;; | ;& | ;;&) ... ESAC
  caseClause() {
    const pos = this.tok.next(LexContext.CommandStart).pos;
    const word = this.readWord(LexContext.Normal);
    this.skipNewlines(LexContext.CommandStart);
    if (!this.accept(Token.In, LexContext.CommandStart))
      this.error("expected 'in' after 'case' word", this.tok.getPos());
    this.skipNewlines(LexContext.CommandStart);
    const items = [];
    let t = this.tok.peek(LexContext.CommandStart).token;
    while (t !== Token.Esac && t !== Token.EOF) {
      const itemPos = this.tok.peek(LexContext.Normal).pos;
      this.accept(Token.LParen, LexContext.Normal);
      const pattern = [];
      t = this.tok.peek(LexContext.Normal).token;
      while (t !== Token.RParen && t !== Token.EOF) {
        if (t !== Token.Pipe)
          pattern.push(this.toWord(this.tok.next(LexContext.Normal)));
        else
          this.tok.next(LexContext.Normal);
        t = this.tok.peek(LexContext.Normal).token;
      }
      const rparenEnd = this.acceptEnd(Token.RParen, LexContext.Normal);
      const cmds = this.list();
      let itemEnd = rparenEnd >= 0 ? rparenEnd : itemPos;
      if (cmds.length > 0)
        itemEnd = cmds[cmds.length - 1].end;
      const item = {
        type: "CaseItem",
        pos: itemPos,
        end: itemEnd,
        pattern,
        body: this.makeCompoundList(cmds),
        terminator: void 0
      };
      t = this.tok.peek(LexContext.CommandStart).token;
      if (t === Token.DoubleSemi || t === Token.SemiAmp || t === Token.DoubleSemiAmp) {
        const termTok = this.tok.next(LexContext.CommandStart);
        item.terminator = CASE_TERMINATORS[termTok.token];
        item.end = termTok.end;
      }
      items.push(item);
      this.skipNewlines(LexContext.CommandStart);
      t = this.tok.peek(LexContext.CommandStart).token;
    }
    const closeEnd = this.acceptEnd(Token.Esac, LexContext.CommandStart);
    if (closeEnd < 0)
      this.error("expected 'esac' to close 'case'", this.tok.getPos());
    const end = closeEnd >= 0 ? closeEnd : pos;
    this._redirects = this.collectTrailingRedirects();
    return { type: "Case", pos, end, word, items };
  }
  // select_clause := SELECT word [IN word* (';'|NL)] DO list DONE
  selectClause() {
    const pos = this.tok.next(LexContext.CommandStart).pos;
    const name = this.readWord(LexContext.Normal);
    const wordlist = [];
    this.skipNewlines(LexContext.CommandStart);
    if (this.tok.peek(LexContext.CommandStart).token === Token.In) {
      this.tok.next(LexContext.CommandStart);
      while (this.tok.peek(LexContext.Normal).token === Token.Word) {
        wordlist.push(this.readWord(LexContext.Normal));
      }
    }
    this.skipSemi();
    this.skipNewlines(LexContext.CommandStart);
    if (!this.accept(Token.Do, LexContext.CommandStart))
      this.error("expected 'do'", this.tok.getPos());
    const body = this.list();
    this.skipSemi();
    const closeEnd = this.acceptEnd(Token.Done, LexContext.CommandStart);
    if (closeEnd < 0)
      this.error("expected 'done' to close 'select'", this.tok.getPos());
    const end = closeEnd >= 0 ? closeEnd : pos;
    this._redirects = this.collectTrailingRedirects();
    return { type: "Select", pos, end, name, wordlist, body: this.makeCompoundList(body) };
  }
  // test_command := [[ test_expr ]]
  testCommand() {
    const pos = this.tok.next(LexContext.CommandStart).pos;
    const expr = this.parseTestOr();
    const closeEnd = this.acceptEnd(Token.DblRBracket, LexContext.TestMode);
    if (closeEnd < 0 && this.tok.peek(LexContext.Normal).token === Token.EOF)
      this.error("expected ']]' to close '[['", this.tok.getPos());
    const end = closeEnd >= 0 ? closeEnd : pos;
    this._redirects = this.collectTrailingRedirects();
    return { type: "TestCommand", pos, end, expression: expr };
  }
  // test_or := test_and ('||' test_and)*
  parseTestOr() {
    let left = this.parseTestAnd();
    while (this.tok.peek(LexContext.TestMode).token === Token.Or) {
      this.tok.next(LexContext.TestMode);
      const right = this.parseTestAnd();
      left = {
        type: "TestLogical",
        pos: left.pos,
        end: right.end,
        operator: "||",
        left,
        right
      };
    }
    return left;
  }
  // test_and := test_not ('&&' test_not)*
  parseTestAnd() {
    let left = this.parseTestNot();
    while (this.tok.peek(LexContext.TestMode).token === Token.And) {
      this.tok.next(LexContext.TestMode);
      const right = this.parseTestNot();
      left = {
        type: "TestLogical",
        pos: left.pos,
        end: right.end,
        operator: "&&",
        left,
        right
      };
    }
    return left;
  }
  // test_not := '!' test_not | test_primary
  parseTestNot() {
    if (this.tok.peek(LexContext.TestMode).token === Token.Word && this.tok.peek(LexContext.TestMode).value === "!") {
      const notPos = this.tok.next(LexContext.TestMode).pos;
      const operand = this.parseTestNot();
      return { type: "TestNot", pos: notPos, end: operand.end, operand };
    }
    return this.parseTestPrimary();
  }
  // test_primary := '(' test_or ')' | unary_op word | word binary_op word | word
  parseTestPrimary() {
    if (this.tok.peek(LexContext.TestMode).token === Token.LParen) {
      const openPos = this.tok.next(LexContext.TestMode).pos;
      const expr = this.parseTestOr();
      const closeEnd = this.acceptEnd(Token.RParen, LexContext.TestMode);
      if (closeEnd < 0)
        this.error("expected ')' to close test group", this.tok.getPos());
      const end = closeEnd >= 0 ? closeEnd : openPos;
      return { type: "TestGroup", pos: openPos, end, expression: expr };
    }
    const first = this.tok.next(LexContext.TestMode);
    const val = first.value;
    const firstPos = first.pos;
    const firstEnd = first.end;
    if (UNARY_TEST_OPS[val] === 1) {
      const nt2 = this.tok.peek(LexContext.TestMode).token;
      if (nt2 === Token.Word) {
        const operand = this.readWord(LexContext.TestMode);
        return {
          type: "TestUnary",
          pos: firstPos,
          end: operand.end,
          operator: val,
          operand
        };
      }
    }
    const nt = this.tok.peek(LexContext.TestMode);
    if (nt.token === Token.Word && BINARY_TEST_OPS[nt.value] === 1) {
      const op = this.tok.next(LexContext.TestMode).value;
      let right;
      if (op === "=~") {
        right = this.toWord(this.tok.readTestRegexWord());
      } else {
        right = this.readWord(LexContext.TestMode);
      }
      const left = this.toWordFromPosEnd(first, firstPos, firstEnd);
      return {
        type: "TestBinary",
        pos: firstPos,
        end: right.end,
        operator: op,
        left,
        right
      };
    }
    const w = this.toWordFromPosEnd(first, firstPos, firstEnd);
    return { type: "TestUnary", pos: firstPos, end: w.end, operator: "-n", operand: w };
  }
  // function_def with 'function' keyword
  functionDef() {
    const pos = this.tok.next(LexContext.CommandStart).pos;
    const name = this.readWord(LexContext.Normal);
    if (this.tok.peek(LexContext.CommandStart).token === Token.LParen) {
      this.tok.next(LexContext.CommandStart);
      if (!this.accept(Token.RParen, LexContext.CommandStart))
        this.error("expected ')' after '('", this.tok.getPos());
    }
    this.skipNewlines(LexContext.CommandStart);
    const body = this.commandAsBody();
    const redirects = this._redirects;
    this._redirects = [];
    const end = redirects.length > 0 ? redirects[redirects.length - 1].end : body.end;
    return { type: "Function", pos, end, name, body, redirects };
  }
  // simple_command or function_def (word '(' ')' body)
  simpleCommandOrFunction() {
    const prefix = [];
    let redirects = [];
    let cmdPos = this.tok.peek(LexContext.CommandStart).pos;
    let lastEnd = cmdPos;
    while (this.tok.peek(LexContext.CommandStart).token === Token.Assignment) {
      const t = this.tok.next(LexContext.CommandStart);
      lastEnd = t.end;
      prefix.push(this.parseAssignment(t));
    }
    while (this.tok.peek(LexContext.CommandStart).token === Token.Redirect) {
      redirects = this.collectRedirect(redirects, LexContext.CommandStart);
      lastEnd = redirects[redirects.length - 1].end;
    }
    if (this.tok.peek(LexContext.Normal).token !== Token.Word) {
      if (prefix.length > 0) {
        return {
          type: "Command",
          pos: cmdPos,
          end: lastEnd,
          name: void 0,
          prefix,
          suffix: EMPTY_SUFFIX,
          redirects
        };
      }
      return {
        type: "Command",
        pos: cmdPos,
        end: lastEnd,
        name: void 0,
        prefix: EMPTY_PREFIX,
        suffix: EMPTY_SUFFIX,
        redirects: EMPTY_REDIRECTS
      };
    }
    const name = this.readWord(LexContext.Normal);
    lastEnd = name.end;
    if (this.tok.peek(LexContext.Normal).token === Token.LParen) {
      this.tok.next(LexContext.Normal);
      if (this.tok.peek(LexContext.Normal).token === Token.RParen) {
        this.tok.next(LexContext.Normal);
        this.skipNewlines(LexContext.CommandStart);
        const body = this.commandAsBody();
        const bodyRedirects = this._redirects;
        this._redirects = [];
        const end = bodyRedirects.length > 0 ? bodyRedirects[bodyRedirects.length - 1].end : body.end;
        return { type: "Function", pos: name.pos, end, name, body, redirects: bodyRedirects };
      }
    }
    const suffix = [];
    for (; ; ) {
      const st = this.tok.peek(LexContext.Normal).token;
      if (st === Token.Word || st === Token.Assignment) {
        const w = this.readWord(LexContext.Normal);
        suffix.push(w);
        lastEnd = w.end;
      } else if (st === Token.Redirect) {
        redirects = this.collectRedirect(redirects, LexContext.Normal);
        lastEnd = redirects[redirects.length - 1].end;
      } else {
        break;
      }
    }
    return { type: "Command", pos: cmdPos, end: lastEnd, name, prefix, suffix, redirects };
  }
  collectRedirect(redirects, ctx) {
    const t = this.tok.next(ctx);
    const tPos = t.pos;
    const tEnd = t.end;
    const r = {
      pos: tPos,
      end: tEnd,
      operator: REDIRECT_OPS[t.value] ?? ">",
      target: void 0,
      fileDescriptor: t.fileDescriptor,
      variableName: t.variableName,
      content: t.content,
      heredocQuoted: void 0,
      body: void 0
    };
    if (t.content != null) {
      r.target = new WordImpl(t.content, t.targetPos, t.targetEnd, this.source);
    }
    if (t.value === "<<" || t.value === "<<-")
      this.tok.registerHereDocTarget(r);
    redirects.push(r);
    return redirects;
  }
  commandAsBody() {
    const t = this.tok.peek(LexContext.CommandStart).token;
    if (t === Token.LBrace)
      return this.braceGroup();
    if (t === Token.LParen)
      return this.subshell();
    const cmd = this.command();
    const p = this.tok.getPos();
    return cmd ?? { type: "CompoundList", pos: p, end: p, commands: [] };
  }
  readWord(ctx) {
    return this.toWord(this.tok.next(ctx));
  }
  toWord(tok) {
    return new WordImpl(this.source.slice(tok.pos, tok.end), tok.pos, tok.end, this.source);
  }
  toWordFromPosEnd(tok, pos, end) {
    return new WordImpl(this.source.slice(pos, end), pos, end, this.source);
  }
  parseAssignment(tok) {
    const text = this.source.slice(tok.pos, tok.end);
    const tokPos = tok.pos;
    const tokEnd = tok.end;
    const result = {
      type: "Assignment",
      pos: tokPos,
      end: tokEnd,
      text,
      name: void 0,
      value: void 0,
      append: void 0,
      index: void 0,
      array: void 0
    };
    const eqIdx = text.indexOf("=");
    if (eqIdx <= 0)
      return result;
    let nameEnd = eqIdx;
    let append = false;
    let index;
    if (text.charCodeAt(eqIdx - 1) === 43) {
      append = true;
      nameEnd = eqIdx - 1;
    }
    const bracketIdx = text.indexOf("[");
    if (bracketIdx > 0 && bracketIdx < nameEnd) {
      const rbracketIdx = text.indexOf("]", bracketIdx);
      if (rbracketIdx > bracketIdx && rbracketIdx + 1 === nameEnd) {
        index = text.slice(bracketIdx + 1, rbracketIdx);
        nameEnd = bracketIdx;
      }
    }
    const name = text.slice(0, nameEnd);
    result.name = name;
    if (append)
      result.append = true;
    if (index !== void 0)
      result.index = index;
    const valStart = eqIdx + 1;
    const valText = text.slice(valStart);
    if (valText.charCodeAt(0) === 40 && valText.charCodeAt(valText.length - 1) === 41) {
      const inner = valText.slice(1, -1);
      const arrayOffset = tokPos + valStart + 1;
      const elements = this.parseArrayElements(inner, arrayOffset);
      result.array = elements;
    } else {
      result.value = new WordImpl(valText, tokPos + valStart, tokEnd, this.source);
    }
    return result;
  }
  parseArrayElements(inner, offset = 0) {
    const subTok = new Lexer(inner);
    const elements = [];
    while (subTok.peek(LexContext.Normal).token !== Token.EOF) {
      if (subTok.peek(LexContext.Normal).token === Token.Newline) {
        subTok.next(LexContext.Normal);
        continue;
      }
      const t = subTok.next(LexContext.Normal);
      if (t.token === Token.Word || t.token === Token.Assignment) {
        const pos = t.pos + offset;
        const end = t.end + offset;
        elements.push(new WordImpl(this.source.slice(pos, end), pos, end, this.source));
      }
    }
    return elements;
  }
  makeCompoundList(commands) {
    const p = this.tok.getPos();
    const pos = commands.length > 0 ? commands[0].pos : p;
    const end = commands.length > 0 ? commands[commands.length - 1].end : p;
    return { type: "CompoundList", pos, end, commands };
  }
};

// src/parser.ts
var import_path = require("path");
var import_os = require("os");
var VAR_REF_REGEX = /^\$\{?(\w+)\}?$/;
function resolveVarRef(text, chainAssignments) {
  const m = text.match(VAR_REF_REGEX);
  if (!m) return null;
  const assignment = chainAssignments.get(m[1]);
  if (!assignment || assignment.isDynamic || assignment.value === null) return null;
  return assignment.value;
}
function isCatHeredocInterpolation(part) {
  if (!part.script) return false;
  const { commands } = part.script;
  if (commands.length !== 1) return false;
  const node = commands[0].command;
  if (node.type !== "Command") return false;
  if (node.name?.value !== "cat") return false;
  if (node.suffix.length > 0) return false;
  const heredoc = node.redirects.find(
    (r) => r.operator === "<<" || r.operator === "<<-"
  );
  if (!heredoc) return false;
  return heredoc.content != null && heredoc.content.includes("\n");
}
function preprocessPathParentheses(input) {
  const result = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < input.length && input[j] !== quote) {
        if (input[j] === "\\" && quote === '"') j++;
        j++;
      }
      result.push(input.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    if (ch === "$" && i + 1 < input.length && input[i + 1] === "(") {
      let depth = 1;
      let j = i + 2;
      while (j < input.length && depth > 0) {
        if (input[j] === "(") depth++;
        else if (input[j] === ")") depth--;
        if (depth > 0) j++;
      }
      result.push(input.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    if (ch !== " " && ch !== "	" && ch !== "\n") {
      let j = i;
      while (j < input.length && !" 	\n".includes(input[j]) && input[j] !== '"' && input[j] !== "'" && !(input[j] === "$" && j + 1 < input.length && input[j + 1] === "(")) {
        j++;
      }
      const token = input.slice(i, j);
      if (token.includes("/") && /[()]/.test(token) && !/^[<>|;&]/.test(token)) {
        result.push('"' + token + '"');
      } else {
        result.push(token);
      }
      i = j;
      continue;
    }
    result.push(ch);
    i++;
  }
  return result.join("");
}
function extractExpansionCommand(text) {
  if (text.startsWith("$(") && text.endsWith(")")) return text.slice(2, -1);
  if (text.startsWith("`") && text.endsWith("`")) return text.slice(1, -1);
  return text;
}
function collectExpansionsFromWord(word, result) {
  if (!word.parts) return;
  for (const part of word.parts) {
    switch (part.type) {
      case "CommandExpansion":
        if (isCatHeredocInterpolation(part)) break;
        result.hasSubshell = true;
        result.subshellCommands.push(extractExpansionCommand(part.text));
        break;
      case "DoubleQuoted":
      case "LocaleString":
        for (const child of part.parts) {
          if (child.type === "CommandExpansion") {
            if (isCatHeredocInterpolation(child)) continue;
            result.hasSubshell = true;
            result.subshellCommands.push(extractExpansionCommand(child.text));
          }
        }
        break;
      case "ProcessSubstitution":
        result.hasSubshell = true;
        break;
    }
  }
}
function extractAssignments(cmd) {
  const assignments = [];
  for (const p of cmd.prefix) {
    if (!p.name) continue;
    const isDynamic = p.value?.parts?.some((part) => part.type === "CommandExpansion") ?? false;
    const value = isDynamic ? null : p.value?.value ?? "";
    assignments.push({ name: p.name, value, isDynamic });
  }
  return assignments;
}
function convertCommand(cmd, chainAssignments) {
  if (!cmd.name) return null;
  let originalCommand = cmd.name.value;
  let resolvedFrom;
  const varMatch = originalCommand.match(VAR_REF_REGEX);
  if (varMatch) {
    const resolved = resolveVarRef(originalCommand, chainAssignments);
    if (resolved !== null) {
      resolvedFrom = originalCommand;
      originalCommand = resolved;
    } else if (chainAssignments.has(varMatch[1])) {
      resolvedFrom = originalCommand;
    }
  }
  const command = originalCommand.includes("/") ? (0, import_path.basename)(originalCommand) : originalCommand;
  const envPrefixes = cmd.prefix.map((p) => p.text);
  const args = cmd.suffix.map((s) => s.value);
  const rawParts = [...envPrefixes, cmd.name.value, ...args];
  const raw = rawParts.join(" ");
  const result = { command, originalCommand, args, envPrefixes, raw };
  if (originalCommand.includes("/")) result.originalPath = originalCommand;
  if (resolvedFrom) result.resolvedFrom = resolvedFrom;
  return result;
}
function updateEffectiveCwd(cdCmd, result) {
  const target = cdCmd.args[0];
  if (!target || target === "-") {
    result.effectiveCwd = void 0;
    return;
  }
  let resolved = target;
  const varMatch = target.match(VAR_REF_REGEX);
  if (varMatch) {
    const assignment = result.chainAssignments.get(varMatch[1]);
    if (assignment && !assignment.isDynamic && assignment.value !== null) {
      resolved = assignment.value;
    } else {
      result.effectiveCwd = void 0;
      return;
    }
  }
  if (resolved.startsWith("/")) {
    result.effectiveCwd = resolved;
  } else if (result.effectiveCwd) {
    result.effectiveCwd = (0, import_path.resolve)(result.effectiveCwd, resolved);
  } else {
    result.effectiveCwd = void 0;
  }
}
function walkCompoundList(list, result) {
  for (const stmt of list.commands) {
    walkNode(stmt, result);
  }
}
function walkIfNode(ifNode, result) {
  walkCompoundList(ifNode.clause, result);
  walkCompoundList(ifNode.then, result);
  if (ifNode.else) {
    if (ifNode.else.type === "If") {
      walkIfNode(ifNode.else, result);
    } else {
      walkCompoundList(ifNode.else, result);
    }
  }
}
function walkNode(node, result) {
  switch (node.type) {
    case "Statement": {
      const stmt = node;
      walkNode(stmt.command, result);
      break;
    }
    case "Command": {
      const cmd = node;
      if (cmd.name) collectExpansionsFromWord(cmd.name, result);
      for (const s of cmd.suffix) collectExpansionsFromWord(s, result);
      const parsed = convertCommand(cmd, result.chainAssignments);
      if (!parsed) {
        for (const a of extractAssignments(cmd)) {
          result.chainAssignments.set(a.name, {
            value: a.value,
            isDynamic: a.isDynamic
          });
        }
        break;
      }
      if ((parsed.command === "sh" || parsed.command === "bash" || parsed.command === "zsh") && parsed.args.length >= 2 && parsed.args[0] === "-c") {
        const innerResult = parseCommand(parsed.args[1]);
        if (innerResult.parseError) {
          result.commands.push(parsed);
        } else {
          result.commands.push(...innerResult.commands);
          if (innerResult.hasSubshell) result.hasSubshell = true;
          result.subshellCommands.push(...innerResult.subshellCommands);
        }
      } else if ((parsed.command === "sh" || parsed.command === "bash" || parsed.command === "zsh") && parsed.args.length >= 1) {
        const scriptIdx = parsed.args.findIndex((a) => !a.startsWith("-"));
        if (scriptIdx !== -1) {
          let scriptPath = parsed.args[scriptIdx];
          if (scriptPath.startsWith("~/")) {
            scriptPath = (0, import_os.homedir)() + scriptPath.slice(1);
          }
          const scriptCommand = scriptPath.includes("/") ? (0, import_path.basename)(scriptPath) : scriptPath;
          const scriptArgs = parsed.args.slice(scriptIdx + 1);
          const scriptCmd = {
            command: scriptCommand,
            originalCommand: scriptPath,
            args: scriptArgs,
            envPrefixes: parsed.envPrefixes,
            raw: parsed.raw
          };
          if (scriptPath.includes("/")) scriptCmd.originalPath = scriptPath;
          result.commands.push(scriptCmd);
        } else {
          result.commands.push(parsed);
        }
      } else {
        result.commands.push(parsed);
      }
      break;
    }
    case "Pipeline": {
      const pipeline = node;
      for (const cmd of pipeline.commands) walkNode(cmd, result);
      break;
    }
    case "AndOr": {
      const andOr = node;
      const savedCwd = result.effectiveCwd;
      result.effectiveCwd = void 0;
      for (const cmd of andOr.commands) {
        const before = result.commands.length;
        walkNode(cmd, result);
        for (let i = before; i < result.commands.length; i++) {
          if (result.effectiveCwd && !result.commands[i].effectiveCwd) {
            result.commands[i].effectiveCwd = result.effectiveCwd;
          }
        }
        for (let i = before; i < result.commands.length; i++) {
          const pc = result.commands[i];
          if (pc.command === "cd") {
            updateEffectiveCwd(pc, result);
          }
        }
      }
      result.effectiveCwd = savedCwd;
      break;
    }
    case "While": {
      const loop = node;
      walkCompoundList(loop.clause, result);
      walkCompoundList(loop.body, result);
      break;
    }
    case "If": {
      walkIfNode(node, result);
      break;
    }
    case "For": {
      walkCompoundList(node.body, result);
      break;
    }
    case "Case": {
      for (const item of node.items) {
        walkCompoundList(item.body, result);
      }
      break;
    }
    case "Function": {
      walkNode(node.body, result);
      break;
    }
    case "Subshell": {
      walkCompoundList(node.body, result);
      break;
    }
    case "BraceGroup": {
      walkCompoundList(node.body, result);
      break;
    }
    case "CompoundList": {
      walkCompoundList(node, result);
      break;
    }
    case "Select": {
      walkCompoundList(node.body, result);
      break;
    }
    case "Coproc": {
      result.hasSubshell = true;
      walkNode(node.body, result);
      break;
    }
    case "ArithmeticFor": {
      walkCompoundList(node.body, result);
      break;
    }
    // TestCommand, ArithmeticCommand: no executable commands to extract
    default:
      break;
  }
}
function parseCommand(input) {
  if (!input || !input.trim()) {
    return {
      commands: [],
      hasSubshell: false,
      subshellCommands: [],
      parseError: false,
      chainAssignments: /* @__PURE__ */ new Map()
    };
  }
  const preprocessed = preprocessPathParentheses(input);
  const ast = parse(preprocessed);
  if (ast.errors?.length) {
    return {
      commands: [],
      hasSubshell: false,
      subshellCommands: [],
      parseError: true,
      chainAssignments: /* @__PURE__ */ new Map()
    };
  }
  const result = {
    commands: [],
    hasSubshell: false,
    subshellCommands: [],
    chainAssignments: /* @__PURE__ */ new Map()
  };
  for (const stmt of ast.commands) {
    walkNode(stmt, result);
  }
  return {
    commands: result.commands,
    hasSubshell: result.hasSubshell,
    subshellCommands: result.subshellCommands,
    parseError: false,
    chainAssignments: result.chainAssignments
  };
}

// src/evaluator.ts
var import_os5 = require("os");

// src/script-scanner.ts
var import_fs = require("fs");
var import_path2 = require("path");
var PYTHON_PATTERNS = [
  // Dangerous
  { regex: /\bos\.system\s*\(/, level: "dangerous", reason: "os.system() executes shell commands" },
  { regex: /\bos\.popen\s*\(/, level: "dangerous", reason: "os.popen() executes shell commands" },
  { regex: /\bos\.exec[a-z]*\s*\(/, level: "dangerous", reason: "os.exec*() replaces the process" },
  { regex: /\bsubprocess\b/, level: "dangerous", reason: "subprocess can execute shell commands" },
  { regex: /\bshutil\.rmtree\s*\(/, level: "dangerous", reason: "shutil.rmtree() deletes directory trees" },
  { regex: /\b__import__\s*\(/, level: "dangerous", reason: "__import__() loads arbitrary modules" },
  { regex: /(?<!\.\s*)(?<!\w)\bexec\s*\(/, level: "dangerous", reason: "exec() executes arbitrary code" },
  { regex: /(?<!\.\s*)(?<!\w)\beval\s*\(/, level: "dangerous", reason: "eval() evaluates arbitrary expressions" },
  { regex: /(?<!re\.)(?<!\w)\bcompile\s*\(/, level: "dangerous", reason: "compile() compiles arbitrary code" },
  { regex: /\bctypes\b/, level: "dangerous", reason: "ctypes allows calling C functions directly" },
  { regex: /\bpickle\.loads?\s*\(/, level: "dangerous", reason: "pickle deserialization can execute arbitrary code" },
  { regex: /\bpickle\.Unpickler\b/, level: "dangerous", reason: "pickle deserialization can execute arbitrary code" },
  // Cautious
  { regex: /\bopen\s*\([^)]*['"][wax]/, level: "cautious", reason: "opens file for writing" },
  { regex: /\bPath\s*[\.(].*\.write_text\s*\(/, level: "cautious", reason: "writes to file via Path" },
  { regex: /\bPath\s*[\.(].*\.write_bytes\s*\(/, level: "cautious", reason: "writes to file via Path" },
  { regex: /\bsocket\b/, level: "cautious", reason: "uses network sockets" },
  { regex: /\brequests\.(post|put|delete)\s*\(/, level: "cautious", reason: "makes mutating HTTP request" },
  { regex: /\burllib\.request\b/, level: "cautious", reason: "makes HTTP requests" },
  { regex: /\bos\.(remove|unlink|rmdir|rename)\s*\(/, level: "cautious", reason: "modifies filesystem" }
];
var TYPESCRIPT_PATTERNS = [
  // Dangerous
  { regex: /\bchild_process\b/, level: "dangerous", reason: "child_process can execute shell commands" },
  { regex: /\bexecSync\s*\(/, level: "dangerous", reason: "execSync() executes shell commands" },
  { regex: /\bspawnSync\s*\(/, level: "dangerous", reason: "spawnSync() executes shell commands" },
  { regex: /\bfs\.rmSync\s*\([^)]*recursive/, level: "dangerous", reason: "fs.rmSync with recursive deletes directory trees" },
  { regex: /\bfs\.rmdirSync\s*\([^)]*recursive/, level: "dangerous", reason: "fs.rmdirSync with recursive deletes directory trees" },
  { regex: /(?<!\.\s*)(?<!\w)\beval\s*\(/, level: "dangerous", reason: "eval() executes arbitrary code" },
  { regex: /\bnew\s+Function\s*\(/, level: "dangerous", reason: "new Function() compiles arbitrary code" },
  { regex: /\bprocess\.exit\s*\(/, level: "dangerous", reason: "process.exit() terminates the process" },
  { regex: /\brimraf\b/, level: "dangerous", reason: "rimraf deletes directory trees" },
  // Cautious
  { regex: /\bfs\.writeFileSync\s*\(/, level: "cautious", reason: "writes to file" },
  { regex: /\bfs\.writeFile\s*\(/, level: "cautious", reason: "writes to file" },
  { regex: /\bfs\.appendFile(Sync)?\s*\(/, level: "cautious", reason: "appends to file" },
  { regex: /\bfs\.unlinkSync\s*\(/, level: "cautious", reason: "deletes file" },
  { regex: /\bfs\.unlink\s*\(/, level: "cautious", reason: "deletes file" },
  { regex: /\bfs\.renameSync\s*\(/, level: "cautious", reason: "renames/moves file" },
  { regex: /\bfetch\s*\([^)]*method\s*:\s*['"]?(POST|PUT|DELETE)/i, level: "cautious", reason: "makes mutating HTTP request" },
  { regex: /\bhttps?\.request\s*\(/, level: "cautious", reason: "makes HTTP request" }
];
var PERL_PATTERNS = [
  // Dangerous
  { regex: /\bsystem\s*\(/, level: "dangerous", reason: "system() executes shell commands" },
  { regex: /\bexec\s*\(/, level: "dangerous", reason: "exec() replaces the process with a shell command" },
  { regex: /`[^`]+`/, level: "dangerous", reason: "backtick execution runs shell commands" },
  { regex: /\bqx\s*[{(]/, level: "dangerous", reason: "qx{} executes shell commands" },
  { regex: /\bunlink\b/, level: "dangerous", reason: "unlink deletes files" },
  { regex: /\beval\s+"/, level: "dangerous", reason: 'eval "" executes arbitrary code (string eval)' },
  { regex: /\brequire\s+\$/, level: "dangerous", reason: "require with variable loads arbitrary modules" },
  // Cautious
  { regex: /\bopen\s*\([^)]*['"]?\s*>{1,2}/, level: "cautious", reason: "opens file for writing" },
  { regex: /\bsocket\b/i, level: "cautious", reason: "uses network sockets" },
  { regex: /\bIO::Socket\b/, level: "cautious", reason: "uses network sockets" },
  { regex: /\bLWP::UserAgent\b/, level: "cautious", reason: "makes HTTP requests" },
  { regex: /\bHTTP::Request\b/, level: "cautious", reason: "makes HTTP requests" },
  { regex: /\brename\s*\(/, level: "cautious", reason: "renames files" },
  { regex: /\brmdir\s*\(/, level: "cautious", reason: "removes directories" },
  { regex: /\bFile::Path::remove_tree\b/, level: "cautious", reason: "removes directory trees" }
];
var PATTERNS_BY_LANGUAGE = {
  python: PYTHON_PATTERNS,
  typescript: TYPESCRIPT_PATTERNS,
  perl: PERL_PATTERNS
};
var MAX_SCRIPT_SIZE = 1024 * 1024;
function scanScriptCode(code, language) {
  const patterns = PATTERNS_BY_LANGUAGE[language];
  for (const pattern of patterns) {
    if (pattern.level === "dangerous" && pattern.regex.test(code)) {
      return { level: "dangerous", reason: pattern.reason };
    }
  }
  for (const pattern of patterns) {
    if (pattern.level === "cautious" && pattern.regex.test(code)) {
      return { level: "cautious", reason: pattern.reason };
    }
  }
  return null;
}
function readScriptFile(filePath, cwd) {
  const fullPath = (0, import_path2.isAbsolute)(filePath) ? filePath : (0, import_path2.resolve)(cwd, filePath);
  try {
    const stat = (0, import_fs.statSync)(fullPath);
    if (stat.size > MAX_SCRIPT_SIZE) {
      return { error: "script too large to scan" };
    }
    const content = (0, import_fs.readFileSync)(fullPath, "utf-8");
    return { content };
  } catch (err) {
    const code = err.code;
    if (code === "EACCES") return { error: "script not readable (permission denied)" };
    return { error: "script not found" };
  }
}

// src/glob.ts
function globToRegex(pattern) {
  let regex = "";
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === "*") {
      while (pattern[i + 1] === "*") i++;
      regex += ".*";
    } else if (ch === "?") {
      regex += ".";
    } else if (ch === "[") {
      i++;
      if (i < pattern.length && pattern[i] === "!") {
        regex += "[^";
        i++;
      } else {
        regex += "[";
      }
      while (i < pattern.length && pattern[i] !== "]") {
        regex += pattern[i];
        i++;
      }
      if (i < pattern.length) {
        regex += "]";
      }
    } else if (ch === "{") {
      const end = pattern.indexOf("}", i);
      if (end !== -1) {
        const alternatives = pattern.slice(i + 1, end).split(",").map((s) => s.replace(/[.+^$|\\()]/g, "\\$&"));
        regex += `(${alternatives.join("|")})`;
        i = end;
      } else {
        regex += "\\{";
      }
    } else if (".+^$|\\()[]".includes(ch)) {
      regex += "\\" + ch;
    } else {
      regex += ch;
    }
    i++;
  }
  return new RegExp(`^${regex}$`);
}
function pathGlobToRegex(pattern) {
  let result = "";
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === "*" && pattern[i + 1] === "*") {
      while (pattern[i + 1] === "*") i++;
      result += ".*";
    } else if (ch === "*") {
      result += "[^/]*";
    } else if (ch === "?") {
      result += "[^/]";
    } else if (ch === "[") {
      i++;
      if (i < pattern.length && pattern[i] === "!") {
        result += "[^";
        i++;
      } else {
        result += "[";
      }
      while (i < pattern.length && pattern[i] !== "]") {
        result += pattern[i];
        i++;
      }
      if (i < pattern.length) {
        result += "]";
      }
    } else if (ch === "{") {
      const end = pattern.indexOf("}", i);
      if (end !== -1) {
        const alternatives = pattern.slice(i + 1, end).split(",").map((s) => s.replace(/[.+^$|\\()]/g, "\\$&"));
        result += `(${alternatives.join("|")})`;
        i = end;
      } else {
        result += "\\{";
      }
    } else if (".+^$|\\()[]".includes(ch)) {
      result += "\\" + ch;
    } else {
      result += ch;
    }
    i++;
  }
  return result;
}

// src/targets.ts
var import_path5 = require("path");
var import_os4 = require("os");

// src/rules.ts
var import_fs2 = require("fs");
var import_yaml = __toESM(require_dist(), 1);
var import_os3 = require("os");
var import_path4 = require("path");

// src/defaults.ts
var import_os2 = require("os");
var import_path3 = require("path");
var SAFE_DEV_TOOLS = [
  "jest",
  "vitest",
  "tsc",
  "tsgo",
  "eslint",
  "prettier",
  "mkdirp",
  "concurrently",
  "turbo",
  "next",
  "nuxt",
  "vite",
  "astro",
  "playwright",
  "cypress",
  "mocha",
  "nyc",
  "c8",
  "ts-jest",
  "tsup",
  "esbuild",
  "rollup",
  "webpack",
  "prisma",
  "drizzle-kit",
  "typeorm",
  "knex",
  "sequelize-cli",
  "tailwindcss",
  "postcss",
  "autoprefixer",
  "lint-staged",
  "husky",
  "changeset",
  "semantic-release",
  "lerna",
  "nx",
  "create-react-app",
  "create-next-app",
  "create-vite",
  "degit",
  "storybook",
  "wrangler",
  "netlify",
  "vercel",
  "json",
  "biome"
];
var SCRIPT_RUNNERS = ["nodemon"];
var REGISTRY_OPS = ["publish", "unpublish", "deprecate", "owner", "access", "token", "adduser", "login", "logout"];
var SAFE_PKG_MANAGER_CMDS = [
  "install",
  "add",
  "remove",
  "uninstall",
  "update",
  "upgrade",
  "outdated",
  "ls",
  "list",
  "run",
  "test",
  "start",
  "build",
  "init",
  "create",
  "info",
  "view",
  "show",
  "why",
  "pack",
  "cache",
  "config",
  "get",
  "set",
  "version",
  "help",
  "exec",
  "dedupe",
  "prune",
  "audit",
  "completion",
  "whoami",
  // Common script aliases (run implicitly by npm/pnpm/yarn/bun)
  "typecheck",
  "type-check",
  "lint",
  "format",
  "check",
  "check-types",
  "test:unit",
  "test:e2e",
  "test:watch",
  "lint:fix"
];
var VERSION_HELP_FLAGS = {
  match: { anyArgMatches: ["^--(version|help)$", "^-[vh]$"] },
  decision: "allow",
  description: "Version/help flags"
};
function anyArgMatchesPattern(items) {
  return `^(${items.join("|")})$`;
}
function safeDevToolsPattern() {
  return {
    match: { anyArgMatches: [anyArgMatchesPattern(SAFE_DEV_TOOLS)] },
    decision: "allow",
    description: "Well-known dev tools"
  };
}
function scriptRunnersPattern() {
  return {
    match: { anyArgMatches: [anyArgMatchesPattern(SCRIPT_RUNNERS)] },
    decision: "ask",
    reason: "runs arbitrary code"
  };
}
function registryOpsPattern() {
  return {
    match: { anyArgMatches: [anyArgMatchesPattern(REGISTRY_OPS)] },
    decision: "ask",
    reason: "modifies package registry"
  };
}
function pkgManagerRule(command, extraSafeCmds = []) {
  const safeCmds = [...SAFE_PKG_MANAGER_CMDS, ...extraSafeCmds];
  return {
    command,
    default: "ask",
    argPatterns: [
      registryOpsPattern(),
      {
        match: { anyArgMatches: [anyArgMatchesPattern(safeCmds)] },
        decision: "allow",
        description: `Standard ${command} commands`
      },
      safeDevToolsPattern(),
      VERSION_HELP_FLAGS
    ]
  };
}
function pkgRunnerRule(command) {
  return {
    command,
    default: "ask",
    argPatterns: [
      safeDevToolsPattern(),
      scriptRunnersPattern(),
      VERSION_HELP_FLAGS
    ]
  };
}
var DEFAULT_TEMP_SCRIPT_DIR = "/tmp";
function buildDefaultSessionGuidance(tempScriptDir) {
  return [
    "Claude Warden is active. It filters Bash commands against safety rules and may ask or deny.",
    "",
    "- For JSON in shell pipelines, prefer `jq` (auto-allowed) over `python3 -c` / `node -e`.",
    `- For multi-line logic, save a temp script under \`${tempScriptDir}/\` (e.g. \`${tempScriptDir}/warden-task.sh\`) or add a \`package.json\` script rather than inline \`bash -c\` / \`node -e\`. Avoid polluting the repo with throwaway scripts.`,
    "- When Warden denies or asks, read the reason \u2014 it often names the preferred alternative.",
    "- To permanently allow a specific command, run `/warden:allow <cmd>`. To temporarily bypass filtering, `/warden:yolo`."
  ].join("\n");
}
var DEFAULT_SESSION_GUIDANCE = buildDefaultSessionGuidance(DEFAULT_TEMP_SCRIPT_DIR);
var DEFAULT_CONFIG = {
  defaultDecision: "ask",
  askOnSubshell: true,
  notifyOnAsk: true,
  notifyOnDeny: true,
  audit: true,
  auditPath: (0, import_path3.join)((0, import_os2.homedir)(), ".claude", "warden-audit.jsonl"),
  auditAllowDecisions: false,
  trustedRemotes: [],
  targetPolicies: [],
  layers: [{
    alwaysAllow: [
      // Read-only file operations
      "cat",
      "head",
      "tail",
      "less",
      "more",
      "wc",
      "sort",
      "uniq",
      "diff",
      "comm",
      "cut",
      "paste",
      "tr",
      "fold",
      "expand",
      "unexpand",
      "column",
      "rev",
      "tac",
      "nl",
      "od",
      "xxd",
      "file",
      "stat",
      // Search/find
      "grep",
      "egrep",
      "fgrep",
      "rg",
      "ag",
      "ack",
      "fd",
      "fzf",
      "locate",
      "which",
      "whereis",
      "type",
      "command",
      // Directory listing
      "ls",
      "dir",
      "tree",
      "exa",
      "eza",
      "lsd",
      // Path/string utilities
      "basename",
      "dirname",
      "realpath",
      "readlink",
      "echo",
      "printf",
      "true",
      "false",
      "test",
      "[",
      // Date/time
      "date",
      "cal",
      // Environment info
      "env",
      "printenv",
      "uname",
      "hostname",
      "whoami",
      "id",
      "pwd",
      // Process viewing (read-only)
      "ps",
      "top",
      "htop",
      "uptime",
      "free",
      "df",
      "du",
      "lsof",
      // Text processing
      "jq",
      "yq",
      "seq",
      // Network diagnostics (read-only)
      "nslookup",
      "dig",
      "host",
      "ping",
      "traceroute",
      "mtr",
      "netstat",
      "ss",
      "ifconfig",
      "ip",
      "nmap",
      "arp",
      // Pagers and formatters
      "bat",
      "pygmentize",
      "highlight",
      // Version managers (read-only)
      "nvm",
      "fnm",
      "rbenv",
      "pyenv",
      // Terminal
      "stty",
      "tput",
      "reset",
      "clear",
      // System/hardware info
      "lscpu",
      "lsblk",
      "lsusb",
      "lspci",
      "lsmod",
      "dmesg",
      "sysctl",
      "sw_vers",
      "system_profiler",
      "hostinfo",
      "lsb_release",
      "hostnamectl",
      "arch",
      "getconf",
      // User/group info
      "groups",
      "getent",
      "w",
      "last",
      "lastlog",
      "finger",
      "users",
      // Process info
      "pgrep",
      "pidof",
      "jobs",
      // Compression/archive
      "tar",
      "gzip",
      "gunzip",
      "bzip2",
      "bunzip2",
      "xz",
      "unxz",
      "zip",
      "unzip",
      "7z",
      "zcat",
      "bzcat",
      "xzcat",
      "zless",
      "zmore",
      "zgrep",
      // Clipboard
      "pbcopy",
      "pbpaste",
      "xclip",
      "xsel",
      "wl-copy",
      "wl-paste",
      // Binary analysis
      "strings",
      "nm",
      "objdump",
      "readelf",
      "ldd",
      "otool",
      "size",
      // ImageMagick
      "magick",
      "convert",
      "identify",
      "mogrify",
      "composite",
      "montage",
      "compare",
      "conjure",
      "stream",
      // macOS utilities (read-only)
      "mdfind",
      "mdls",
      "mdutil",
      "plutil",
      "sips",
      "xcode-select",
      "xcrun",
      "xcodebuild",
      "networkQuality",
      // Misc safe
      "cd",
      "pushd",
      "popd",
      "dirs",
      "hash",
      "alias",
      "set",
      "unset",
      "sleep",
      "wait",
      "time",
      "md5",
      "md5sum",
      "sha256sum",
      "shasum",
      "cksum",
      "base64",
      "watch",
      "timeout",
      "nohup",
      "nice",
      "iconv",
      "locale",
      "localedef",
      "numfmt",
      "factor",
      "bc",
      "dc"
    ],
    alwaysDeny: [
      "sudo",
      "su",
      "doas",
      "eval",
      "mkfs",
      "fdisk",
      "dd",
      "shutdown",
      "reboot",
      "halt",
      "poweroff",
      "iptables",
      "ip6tables",
      "nft",
      "useradd",
      "userdel",
      "usermod",
      "groupadd",
      "groupdel",
      "crontab",
      "systemctl",
      "service",
      "launchctl",
      "wipefs",
      "shred"
    ],
    rules: [
      // --- CLI tools ---
      {
        command: "claude",
        default: "ask",
        argPatterns: [
          { match: { anyArgMatches: ["^--(version|help)$", "^-[vh]$"] }, decision: "allow", description: "Version/help flags" },
          { match: { argsMatch: ["^plugin(s)?\\s+(list|help|validate|marketplace\\s+(list|help))\\b"] }, decision: "allow", description: "Read-only plugin commands" }
        ]
      },
      // --- Shell builtins ---
      {
        command: "export",
        default: "allow",
        argPatterns: [
          {
            match: { anyArgMatches: [
              "^(LD_PRELOAD|LD_LIBRARY_PATH|DYLD_INSERT_LIBRARIES|DYLD_LIBRARY_PATH|DYLD_FRAMEWORK_PATH)="
            ] },
            decision: "ask",
            description: "Env vars that control library loading"
          },
          {
            match: { anyArgMatches: [
              "^PATH=.*\\$(PATH|\\{PATH\\})"
            ] },
            decision: "allow",
            description: "PATH extension (preserves existing PATH)"
          },
          {
            match: { anyArgMatches: [
              "^PATH="
            ] },
            decision: "ask",
            description: "PATH replacement (drops existing PATH)"
          }
        ]
      },
      // --- Shell sourcing ---
      ...["source", "."].map((cmd) => ({
        command: cmd,
        default: "ask",
        argPatterns: [
          {
            match: { anyArgMatches: [
              "(\\.bashrc|\\.zshrc|\\.profile|\\.bash_profile|\\.zprofile|\\.shrc)$",
              "nvm\\.sh$",
              "\\.envrc$",
              "\\.env$"
            ] },
            decision: "allow",
            description: "Common shell config and env files"
          },
          {
            match: { noArgs: true },
            decision: "deny",
            reason: "missing file argument"
          }
        ]
      })),
      // --- Shell interpreters ---
      ...["bash", "sh", "zsh"].map((cmd) => ({
        command: cmd,
        default: "ask",
        argPatterns: [
          { match: { anyArgMatches: ["^--(version|help)$"] }, decision: "allow", description: "Version/help flags" }
        ]
      })),
      // --- Node.js ecosystem ---
      { command: "node", default: "ask" },
      { command: "tsx", default: "ask" },
      { command: "ts-node", default: "ask" },
      // npx / bunx - package runners
      pkgRunnerRule("npx"),
      pkgRunnerRule("bunx"),
      pkgRunnerRule("pnpx"),
      // npm / pnpm / yarn - package managers
      pkgManagerRule("npm", ["ci", "search", "explain", "prefix", "root", "fund", "doctor", "diff", "pkg", "query", "shrinkwrap"]),
      pkgManagerRule("pnpm", ["store", "fetch", "doctor", "patch", "--filter", "-F", "--recursive", "-r", "--workspace-root", "-w"]),
      pkgManagerRule("yarn", ["up", "dlx", "workspaces"]),
      // bun - runtime + package manager
      {
        command: "bun",
        default: "ask",
        argPatterns: [
          { match: { anyArgMatches: [anyArgMatchesPattern([...SAFE_PKG_MANAGER_CMDS, "ci", "pm", "x", "link", "unlink"])] }, decision: "allow", description: "Standard bun commands" },
          safeDevToolsPattern(),
          scriptRunnersPattern(),
          VERSION_HELP_FLAGS
        ]
      },
      // --- Python ---
      ...["python", "python3"].map((cmd) => ({
        command: cmd,
        default: "ask"
      })),
      { command: "pip", default: "allow" },
      { command: "pip3", default: "allow" },
      {
        command: "uv",
        default: "ask",
        argPatterns: [
          { match: { anyArgMatches: ["^publish$"] }, decision: "ask", reason: "publishes to PyPI" },
          { match: { anyArgMatches: [anyArgMatchesPattern([
            "pip",
            "venv",
            "init",
            "add",
            "remove",
            "lock",
            "sync",
            "tree",
            "cache",
            "self",
            "version",
            "help",
            "python",
            "export"
          ])] }, decision: "allow", description: "Safe uv subcommands" },
          VERSION_HELP_FLAGS
        ]
      },
      { command: "pipx", default: "ask" },
      // --- Git ---
      {
        command: "git",
        default: "allow",
        argPatterns: [
          { match: { argsMatch: ["push\\s+--force", "push\\s+-f\\b"] }, decision: "ask", reason: "force push overwrites remote history" },
          { match: { argsMatch: ["reset\\s+--hard"] }, decision: "ask", reason: "hard reset discards uncommitted changes" },
          { match: { anyArgMatches: ["^clean$"] }, decision: "ask", reason: "removes untracked files" }
        ]
      },
      {
        command: "gh",
        default: "allow",
        argPatterns: [
          { match: { argsMatch: ["repo\\s+delete", "repo\\s+archive"] }, decision: "ask", reason: "destructive repo operation" }
        ]
      },
      // --- Build tools ---
      { command: "make", default: "allow" },
      { command: "cmake", default: "allow" },
      {
        command: "cargo",
        default: "allow",
        argPatterns: [
          { match: { anyArgMatches: ["^(publish|login|logout|owner|yank)$"] }, decision: "ask", reason: "Registry modification" }
        ]
      },
      {
        command: "go",
        default: "allow",
        argPatterns: [
          { match: { anyArgMatches: ["^generate$"] }, decision: "ask", reason: "runs arbitrary commands" }
        ]
      },
      { command: "rustup", default: "allow" },
      { command: "tsc", default: "allow" },
      { command: "tsgo", default: "allow" },
      { command: "turbo", default: "allow" },
      { command: "nx", default: "allow" },
      { command: "lerna", default: "allow" },
      // --- Docker ---
      {
        command: "docker",
        default: "ask",
        argPatterns: [
          { match: { anyArgMatches: ["^(ps|images|logs|inspect|stats|top|version|info)$"] }, decision: "allow", description: "Read-only docker commands" },
          { match: { anyArgMatches: ["^(build|run|compose|exec|pull|stop|start|restart|create)$"] }, decision: "ask", reason: "modifies Docker state" },
          { match: { anyArgMatches: ["^(system\\s+prune|container\\s+prune|image\\s+prune)$"] }, decision: "ask", reason: "prunes Docker resources" }
        ]
      },
      { command: "docker-compose", default: "ask" },
      {
        command: "kubectl",
        default: "ask",
        argPatterns: [
          { match: { anyArgMatches: ["^(get|describe|logs|top|explain|api-resources|api-versions|version|config|cluster-info)$"] }, decision: "allow", description: "Read-only kubectl commands" },
          { match: { anyArgMatches: ["^(delete|drain|cordon|taint)$"] }, decision: "ask", reason: "destructive cluster operation" },
          VERSION_HELP_FLAGS
        ]
      },
      // --- Potentially dangerous text/file tools ---
      // `find` is handled specially in the evaluator (recursive -exec evaluation)
      {
        command: "sed",
        default: "allow",
        argPatterns: [
          { match: { anyArgMatches: ["^-i$", "^-i\\b", "^--in-place"] }, decision: "ask", reason: "modifies files in place" }
        ]
      },
      {
        command: "awk",
        default: "allow",
        argPatterns: [
          { match: { argsMatch: ["system\\s*\\(", "\\|\\s*getline", "print\\s*>"] }, decision: "ask", reason: "awk system() or file output" }
        ]
      },
      {
        command: "xargs",
        default: "ask",
        argPatterns: [
          { match: { noArgs: true }, decision: "allow", description: "xargs with no args runs echo (safe)" }
        ]
      },
      {
        command: "tee",
        default: "allow",
        argPatterns: [
          { match: { anyArgMatches: ["^/(etc|usr|var|sys|proc|boot|root|lib)"] }, decision: "ask", reason: "writes to system directory" }
        ]
      },
      {
        command: "openssl",
        default: "allow",
        argPatterns: [
          { match: { anyArgMatches: ["^(enc|rsautl|pkeyutl|smime|cms)$"] }, decision: "ask", reason: "encryption/signing" }
        ]
      },
      // --- File operations ---
      {
        command: "rm",
        default: "ask",
        argPatterns: [
          { match: { anyArgMatches: ["^-[^\\s]*r[^\\s]*f$|^-[^\\s]*f[^\\s]*r$"] }, decision: "ask", reason: "recursive force delete" },
          { match: { anyArgMatches: ["^-[^\\s]*r"] }, decision: "ask", reason: "Recursive delete" },
          { match: { argCount: { max: 3 }, not: false }, decision: "allow", description: "Deleting a small number of non-recursive files" }
        ]
      },
      { command: "mkdir", default: "allow" },
      { command: "touch", default: "allow" },
      { command: "cp", default: "allow" },
      { command: "mv", default: "allow" },
      { command: "ln", default: "allow" },
      {
        command: "chmod",
        default: "ask",
        argPatterns: [
          { match: { argsMatch: ["-R\\s+777"] }, decision: "deny", reason: "recursive world-writable permissions" }
        ]
      },
      { command: "chown", default: "ask" },
      // --- Network ---
      { command: "curl", default: "allow" },
      { command: "wget", default: "allow" },
      { command: "ssh", default: "ask" },
      { command: "scp", default: "ask" },
      { command: "rsync", default: "ask" },
      // --- Package managers ---
      { command: "brew", default: "allow" },
      { command: "apt", default: "ask" },
      { command: "apt-get", default: "ask" },
      { command: "yum", default: "ask" },
      { command: "dnf", default: "ask" },
      { command: "pacman", default: "ask" },
      // --- Terraform / IaC ---
      { command: "terraform", default: "ask", argPatterns: [
        { match: { anyArgMatches: ["^(plan|validate|fmt|show|state|output|providers|version|graph|console)$"] }, decision: "allow", description: "Read-only terraform commands" }
      ] },
      // --- macOS open ---
      { command: "open", default: "ask" },
      // --- Text editors ---
      ...["vi", "vim", "nvim", "nano", "emacs"].map((cmd) => ({
        command: cmd,
        default: "ask",
        argPatterns: [VERSION_HELP_FLAGS]
      })),
      // --- Scripting languages ---
      { command: "perl", default: "ask" },
      ...["ruby", "php"].map((cmd) => ({
        command: cmd,
        default: "ask",
        argPatterns: [
          { match: { anyArgMatches: ["^-e$", "^--eval"] }, decision: "ask", reason: "evaluates inline code" },
          VERSION_HELP_FLAGS
        ]
      })),
      // --- Java ecosystem ---
      { command: "java", default: "ask", argPatterns: [VERSION_HELP_FLAGS] },
      { command: "javac", default: "allow" },
      // --- Swift / Zig / Dotnet ---
      { command: "swift", default: "allow", argPatterns: [
        { match: { anyArgMatches: ["^(build|test|run|package)$"] }, decision: "allow" }
      ] },
      { command: "swiftc", default: "allow" },
      { command: "zig", default: "allow" },
      { command: "dotnet", default: "allow", argPatterns: [
        { match: { anyArgMatches: ["^(publish|nuget)$"] }, decision: "ask", reason: "publishes package" }
      ] },
      // --- Database CLIs ---
      ...["psql", "mysql", "mariadb", "sqlite3", "redis-cli", "mongosh"].map((cmd) => ({
        command: cmd,
        default: "ask",
        argPatterns: [VERSION_HELP_FLAGS]
      })),
      // --- Cloud CLIs ---
      { command: "gcloud", default: "ask", argPatterns: [
        { match: { anyArgMatches: ["^(info|version|help|topic|components|feedback|survey)$"] }, decision: "allow", description: "Info/meta commands" },
        { match: { anyArgMatches: ["^config$"] }, decision: "allow", description: "Config subcommands" },
        { match: { anyArgMatches: ["^(list|describe|get|get-iam-policy|browse|tail|read|show|search|lookup|check)$"] }, decision: "allow", description: "Read-only verbs" },
        { match: { anyArgMatches: ["^(list|get|describe|show|print|read|search|lookup|check)-[a-z][a-z0-9-]*$"] }, decision: "allow", description: "Read-only verb-noun (list-enabled, get-value, print-access-token, etc.)" },
        VERSION_HELP_FLAGS
      ] },
      { command: "az", default: "ask", argPatterns: [
        { match: { anyArgMatches: ["^(list|show|get|search|check)$"] }, decision: "allow", description: "Read-only verbs" },
        { match: { anyArgMatches: ["^(list|show|get|search|check)-[a-z][a-z0-9-]*$"] }, decision: "allow", description: "Read-only verb-noun" },
        { match: { anyArgMatches: ["^(version|help|account|feedback)$"] }, decision: "allow", description: "Info/meta commands" },
        VERSION_HELP_FLAGS
      ] },
      { command: "aws", default: "ask", argPatterns: [
        { match: { anyArgMatches: ["^(describe|list|get|sts|help|search|lookup|check)$"] }, decision: "allow", description: "Read-only verbs" },
        { match: { anyArgMatches: ["^(describe|list|get|search|lookup|check)-[a-z][a-z0-9-]*$"] }, decision: "allow", description: "Read-only verb-noun" },
        VERSION_HELP_FLAGS
      ] },
      // --- Helm ---
      { command: "helm", default: "ask", argPatterns: [
        { match: { anyArgMatches: ["^(list|search|show|status|get|template|version|env|history)$"] }, decision: "allow", description: "Read-only helm commands" },
        VERSION_HELP_FLAGS
      ] },
      // --- Fly.io ---
      ...["fly", "flyctl"].map((cmd) => ({
        command: cmd,
        default: "ask",
        argPatterns: [
          { match: { anyArgMatches: ["^(status|logs|info|version|platform|doctor|dig)$"] }, decision: "allow", description: "Read-only fly commands" },
          { match: { argsMatch: ["^apps\\s+list"] }, decision: "allow", description: "List fly apps" },
          { match: { anyArgMatches: ["^(deploy|destroy|scale|secrets)$"] }, decision: "ask", reason: "Destructive fly operation" },
          VERSION_HELP_FLAGS
        ]
      })),
      // --- Screen/tmux ---
      ...["screen", "tmux"].map((cmd) => ({
        command: cmd,
        default: "ask",
        argPatterns: [
          { match: { anyArgMatches: ["^(list-sessions|ls|list)$"] }, decision: "allow", description: "List sessions" },
          VERSION_HELP_FLAGS
        ]
      })),
      // --- GPG ---
      { command: "gpg", default: "ask", argPatterns: [
        { match: { anyArgMatches: ["^(--verify|--list-keys|--list-secret-keys|--fingerprint)$"] }, decision: "allow", description: "Read-only gpg" },
        VERSION_HELP_FLAGS
      ] },
      // --- macOS-specific ---
      { command: "defaults", default: "ask", argPatterns: [
        { match: { anyArgMatches: ["^(read|read-type|find|domains)$"] }, decision: "allow", description: "Read-only defaults operations" }
      ] },
      { command: "diskutil", default: "ask", argPatterns: [
        { match: { anyArgMatches: ["^(list|info|apfs|cs|appleRAID)$"] }, decision: "allow", description: "Read-only diskutil" }
      ] },
      { command: "codesign", default: "ask", argPatterns: [
        { match: { anyArgMatches: ["^(-vv|--verify|--display|-d)$"] }, decision: "allow", description: "Verify codesign" }
      ] },
      { command: "networksetup", default: "ask", argPatterns: [
        { match: { anyArgMatches: ["^-(get|list|show)"] }, decision: "allow", description: "Read-only network configuration queries" }
      ] },
      { command: "scutil", default: "ask", argPatterns: [
        { match: { anyArgMatches: ["^--get$", "^--dns$", "^--proxy$", "^--nwi$"] }, decision: "allow", description: "Read-only system configuration queries" }
      ] },
      { command: "osascript", default: "ask" },
      { command: "say", default: "ask" },
      // --- Process management ---
      { command: "kill", default: "ask" },
      { command: "killall", default: "ask" },
      { command: "pkill", default: "ask" },
      { command: "renice", default: "ask" }
    ]
  }]
};

// src/rules.ts
var VALID_DECISIONS = /* @__PURE__ */ new Set(["allow", "deny", "ask"]);
function isValidDecision(value) {
  return VALID_DECISIONS.has(value);
}
var quiet = true;
function warn(message) {
  if (quiet) return;
  process.stderr.write(message);
}
var USER_CONFIG_PATHS = [
  (0, import_path4.join)((0, import_os3.homedir)(), ".claude", "warden.yaml"),
  (0, import_path4.join)((0, import_os3.homedir)(), ".claude", "warden.json")
];
var PROJECT_CONFIG_NAMES = [
  ".claude/warden.yaml",
  ".claude/warden.json"
];
function loadConfig(cwd) {
  const config = structuredClone(DEFAULT_CONFIG);
  const defaultLayer = config.layers[0];
  let userLayer = null;
  let userRaw = null;
  for (const configPath of USER_CONFIG_PATHS) {
    const result = tryLoadFile(configPath);
    if (result) {
      userLayer = extractLayer(result);
      userRaw = result;
      break;
    }
  }
  let workspaceLayer = null;
  let workspaceRaw = null;
  if (cwd) {
    for (const name of PROJECT_CONFIG_NAMES) {
      const result = tryLoadFile((0, import_path4.join)(cwd, name));
      if (result) {
        workspaceLayer = extractLayer(result);
        workspaceRaw = result;
        break;
      }
    }
  }
  config.layers = [
    ...workspaceLayer ? [workspaceLayer] : [],
    ...userLayer ? [userLayer] : [],
    defaultLayer
  ];
  if (userRaw) mergeNonLayerFields(config, userRaw);
  if (workspaceRaw) mergeNonLayerFields(config, workspaceRaw);
  return config;
}
function tryLoadFile(filePath) {
  if (!(0, import_fs2.existsSync)(filePath)) return null;
  try {
    const raw = (0, import_fs2.readFileSync)(filePath, "utf-8");
    const parsed = filePath.endsWith(".yaml") || filePath.endsWith(".yml") ? (0, import_yaml.parse)(raw) : JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch (err) {
    warn(`[warden] Warning: failed to parse config ${filePath}: ${err instanceof Error ? err.message : String(err)}
`);
  }
  return null;
}
function extractLayer(raw) {
  const rules = Array.isArray(raw.rules) ? raw.rules : [];
  for (const rule of rules) {
    if (rule && typeof rule === "object") {
      if (rule.default && !isValidDecision(rule.default)) {
        warn(`[warden] Warning: invalid rule default "${rule.default}" for "${rule.command}", using "ask"
`);
        rule.default = "ask";
      }
      if (Array.isArray(rule.argPatterns)) {
        for (const pattern of rule.argPatterns) {
          if (pattern?.decision && !isValidDecision(pattern.decision)) {
            warn(`[warden] Warning: invalid pattern decision "${pattern.decision}" for "${rule.command}", using "ask"
`);
            pattern.decision = "ask";
          }
        }
      }
    }
  }
  return {
    alwaysAllow: Array.isArray(raw.alwaysAllow) ? raw.alwaysAllow : [],
    alwaysDeny: Array.isArray(raw.alwaysDeny) ? raw.alwaysDeny : [],
    rules
  };
}
function parseTrustedList(raw) {
  return raw.map((entry) => {
    if (typeof entry === "string") return { name: entry };
    if (entry && typeof entry === "object" && "name" in entry) {
      const obj = entry;
      const target = { name: String(obj.name) };
      if (obj.allowAll === true) target.allowAll = true;
      if (obj.overrides && typeof obj.overrides === "object") {
        target.overrides = extractLayer(obj.overrides);
      }
      return target;
    }
    return null;
  }).filter((t) => t !== null);
}
var VALID_REMOTE_CONTEXTS = /* @__PURE__ */ new Set(["ssh", "docker", "kubectl", "sprite", "fly"]);
function parseTrustedRemotes(raw) {
  const results = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry;
    const context = String(obj.context || "");
    if (!VALID_REMOTE_CONTEXTS.has(context)) {
      warn(`[warden] Warning: unknown remote context "${context}", skipping
`);
      continue;
    }
    const name = String(obj.name || "");
    if (!name) continue;
    const remote = { name, context };
    if (obj.allowAll === true) remote.allowAll = true;
    if (obj.overrides && typeof obj.overrides === "object") {
      remote.overrides = extractLayer(obj.overrides);
    }
    results.push(remote);
  }
  return results;
}
function parseTargetPolicies(raw) {
  const results = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || !("type" in entry)) {
      warn(`[warden] Warning: targetPolicies entry missing "type" field, skipping
`);
      continue;
    }
    const obj = entry;
    if (typeof obj.decision !== "string" || !isValidDecision(obj.decision)) {
      warn(`[warden] Warning: targetPolicies entry missing or invalid "decision", skipping
`);
      continue;
    }
    const base = {
      decision: obj.decision,
      ...typeof obj.reason === "string" && { reason: obj.reason },
      ...Array.isArray(obj.commands) && { commands: obj.commands },
      ...obj.allowAll === true && { allowAll: true }
    };
    switch (obj.type) {
      case "path": {
        if (typeof obj.path !== "string") {
          warn(`[warden] Warning: path targetPolicy missing "path" field, skipping
`);
          continue;
        }
        const policy = { ...base, type: "path", path: obj.path, recursive: typeof obj.recursive === "boolean" ? obj.recursive : true };
        results.push(policy);
        break;
      }
      case "database": {
        if (typeof obj.host !== "string") {
          warn(`[warden] Warning: database targetPolicy missing "host" field, skipping
`);
          continue;
        }
        const policy = {
          ...base,
          type: "database",
          host: obj.host,
          ...typeof obj.port === "number" && { port: obj.port },
          ...typeof obj.database === "string" && { database: obj.database }
        };
        results.push(policy);
        break;
      }
      case "endpoint": {
        if (typeof obj.pattern !== "string") {
          warn(`[warden] Warning: endpoint targetPolicy missing "pattern" field, skipping
`);
          continue;
        }
        const policy = { ...base, type: "endpoint", pattern: obj.pattern };
        results.push(policy);
        break;
      }
      default:
        warn(`[warden] Warning: unknown targetPolicy type "${String(obj.type)}", skipping
`);
    }
  }
  return results;
}
var LEGACY_REMOTE_MAP = {
  trustedSSHHosts: "ssh",
  trustedDockerContainers: "docker",
  trustedKubectlContexts: "kubectl",
  trustedSprites: "sprite",
  trustedFlyApps: "fly"
};
function mergeNonLayerFields(config, raw) {
  if (Array.isArray(raw.trustedRemotes)) {
    config.trustedRemotes = [...config.trustedRemotes, ...parseTrustedRemotes(raw.trustedRemotes)];
  }
  for (const [key, context] of Object.entries(LEGACY_REMOTE_MAP)) {
    if (Array.isArray(raw[key])) {
      warn(`[warden] Warning: ${key} is deprecated, use trustedRemotes with context: "${context}" instead
`);
      const targets = parseTrustedList(raw[key]);
      config.trustedRemotes = [...config.trustedRemotes, ...targets.map((t) => ({ ...t, context }))];
    }
  }
  if (Array.isArray(raw.targetPolicies)) {
    config.targetPolicies = [...config.targetPolicies, ...parseTargetPolicies(raw.targetPolicies)];
  }
  if (typeof raw.defaultDecision === "string") {
    if (isValidDecision(raw.defaultDecision)) {
      config.defaultDecision = raw.defaultDecision;
    } else {
      warn(`[warden] Warning: invalid defaultDecision "${raw.defaultDecision}", ignoring
`);
    }
  }
  if (typeof raw.askOnSubshell === "boolean") {
    config.askOnSubshell = raw.askOnSubshell;
  }
  if (typeof raw.notifyOnAsk === "boolean") {
    config.notifyOnAsk = raw.notifyOnAsk;
  }
  if (typeof raw.notifyOnDeny === "boolean") {
    config.notifyOnDeny = raw.notifyOnDeny;
  }
  if (typeof raw.sessionGuidance === "string" || raw.sessionGuidance === false) {
    config.sessionGuidance = raw.sessionGuidance;
  } else if (raw.sessionGuidance !== void 0) {
    warn(`[warden] Warning: invalid sessionGuidance (expected string or false), ignoring
`);
  }
  if (typeof raw.tempScriptDir === "string" && raw.tempScriptDir.length > 0) {
    config.tempScriptDir = raw.tempScriptDir;
  } else if (raw.tempScriptDir !== void 0) {
    warn(`[warden] Warning: invalid tempScriptDir (expected non-empty string), ignoring
`);
  }
  if (typeof raw.audit === "boolean") {
    config.audit = raw.audit;
  }
  if (typeof raw.auditPath === "string") {
    config.auditPath = raw.auditPath;
  }
  if (typeof raw.auditAllowDecisions === "boolean") {
    config.auditAllowDecisions = raw.auditAllowDecisions;
  }
  if (raw.trustedContextOverrides && typeof raw.trustedContextOverrides === "object") {
    const overrides = raw.trustedContextOverrides;
    const layer = extractLayer(overrides);
    if (config.trustedContextOverrides) {
      config.trustedContextOverrides = {
        alwaysAllow: [...layer.alwaysAllow, ...config.trustedContextOverrides.alwaysAllow],
        alwaysDeny: [...layer.alwaysDeny, ...config.trustedContextOverrides.alwaysDeny],
        rules: [...layer.rules, ...config.trustedContextOverrides.rules]
      };
    } else {
      config.trustedContextOverrides = layer;
    }
  }
}

// src/targets.ts
var PATH_COMMANDS = ["rm", "chmod", "chown", "cp", "mv", "tee", "mkdir", "rmdir", "touch", "ln"];
var DATABASE_COMMANDS = ["psql", "mysql", "mariadb", "redis-cli", "mongosh", "mongo", "pg_dump", "mysqldump", "mongodump"];
var ENDPOINT_COMMANDS = ["curl", "wget", "http", "httpie"];
function expandHome(p) {
  if (p === "~") return (0, import_os4.homedir)();
  if (p.startsWith("~/")) return (0, import_os4.homedir)() + p.slice(1);
  return p;
}
function expandCwd(p, cwd) {
  return p.replace(/\{\{cwd\}\}/g, cwd);
}
function defaultCommandsForType(type) {
  switch (type) {
    case "path":
      return PATH_COMMANDS;
    case "database":
      return DATABASE_COMMANDS;
    case "endpoint":
      return ENDPOINT_COMMANDS;
  }
}
function policyAppliesToCommand(policy, command) {
  if (policy.allowAll) return true;
  const commands = policy.commands ?? defaultCommandsForType(policy.type);
  return commands.includes(command);
}
function hasGlobChars(s) {
  return /[*?[\]{]/.test(s);
}
function evaluatePathPolicy(policy, cmd, cwd) {
  const recursive = policy.recursive ?? true;
  const expandedPath = expandHome(expandCwd(policy.path, cwd));
  const policyPath = (0, import_path5.normalize)((0, import_path5.resolve)(cwd, expandedPath));
  const pathWithoutTemplate = policy.path.replace(/\{\{cwd\}\}/g, "");
  const useGlob = hasGlobChars(pathWithoutTemplate);
  let globRegex = null;
  if (useGlob) {
    try {
      globRegex = new RegExp(`^${pathGlobToRegex(policyPath)}${recursive ? "(/.*)?" : ""}$`);
    } catch {
      warn(`[warden] Warning: invalid glob pattern in path target policy: ${policy.path}
`);
      return false;
    }
  }
  for (const arg of cmd.args) {
    if (arg.startsWith("-")) continue;
    const argPath = (0, import_path5.normalize)((0, import_path5.resolve)(cwd, expandHome(arg)));
    if (globRegex) {
      if (globRegex.test(argPath)) return true;
    } else {
      if (recursive) {
        if (argPath === policyPath || argPath.startsWith(policyPath + "/")) return true;
      } else {
        if (argPath === policyPath) return true;
      }
    }
  }
  return false;
}
function parseConnectionFlags(args) {
  const info = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--host=")) {
      info.host = arg.slice(7);
      continue;
    }
    if (arg.startsWith("--port=")) {
      info.port = Number(arg.slice(7));
      continue;
    }
    if (arg.startsWith("--dbname=")) {
      info.database = arg.slice(9);
      continue;
    }
    if (arg === "--host" && i + 1 < args.length) {
      info.host = args[++i];
      continue;
    }
    if (arg === "--port" && i + 1 < args.length) {
      info.port = Number(args[++i]);
      continue;
    }
    if (arg === "--dbname" && i + 1 < args.length) {
      info.database = args[++i];
      continue;
    }
    if (arg === "-h" && i + 1 < args.length) {
      info.host = args[++i];
      continue;
    }
    if (arg === "-d" && i + 1 < args.length) {
      info.database = args[++i];
      continue;
    }
    if (arg === "-p" && i + 1 < args.length) {
      info.port = Number(args[++i]);
      continue;
    }
  }
  return info;
}
function parseConnectionUri(args) {
  const uriPattern = /^(postgresql|postgres|mongodb|redis|mysql|mariadb):\/\//;
  for (const arg of args) {
    if (!uriPattern.test(arg)) continue;
    try {
      const url = new URL(arg);
      const info = {};
      if (url.hostname) info.host = url.hostname;
      if (url.port) info.port = Number(url.port);
      const dbPath = url.pathname.replace(/^\//, "");
      if (dbPath) info.database = dbPath;
      return info;
    } catch {
      continue;
    }
  }
  return {};
}
function evaluateDatabasePolicy(policy, cmd) {
  const flagInfo = parseConnectionFlags(cmd.args);
  const uriInfo = parseConnectionUri(cmd.args);
  const host = flagInfo.host ?? uriInfo.host;
  const port = flagInfo.port ?? uriInfo.port;
  const database = flagInfo.database ?? uriInfo.database;
  if (!host && !port && !database) return false;
  if (policy.host !== void 0) {
    if (host === void 0) return false;
    try {
      const hostRegex = globToRegex(policy.host);
      if (!hostRegex.test(host)) return false;
    } catch {
      warn(`[warden] Warning: invalid glob pattern in database host policy: ${policy.host}
`);
      return false;
    }
  }
  if (policy.port !== void 0) {
    if (port === void 0 || port !== policy.port) return false;
  }
  if (policy.database !== void 0) {
    if (database === void 0) return false;
    try {
      const dbRegex = globToRegex(policy.database);
      if (!dbRegex.test(database)) return false;
    } catch {
      warn(`[warden] Warning: invalid glob pattern in database policy: ${policy.database}
`);
      return false;
    }
  }
  return true;
}
function extractUrls(cmd) {
  const urls = [];
  const args = cmd.args;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--url" && i + 1 < args.length) {
      urls.push(args[++i]);
      continue;
    }
    if (arg.startsWith("--url=")) {
      urls.push(arg.slice(6));
      continue;
    }
    if (arg.startsWith("http://") || arg.startsWith("https://")) {
      urls.push(arg);
    }
  }
  return urls;
}
function evaluateEndpointPolicy(policy, cmd) {
  const urls = extractUrls(cmd);
  let patternRegex;
  try {
    patternRegex = globToRegex(policy.pattern);
  } catch {
    warn(`[warden] Warning: invalid glob pattern in endpoint policy: ${policy.pattern}
`);
    return false;
  }
  return urls.some((url) => patternRegex.test(url));
}
function policyMatches(policy, cmd, cwd) {
  switch (policy.type) {
    case "path":
      return evaluatePathPolicy(policy, cmd, cwd);
    case "database":
      return evaluateDatabasePolicy(policy, cmd);
    case "endpoint":
      return evaluateEndpointPolicy(policy, cmd);
  }
}
function evaluateTargetPolicies(cmd, cwd, config) {
  const matching = [];
  for (const policy of config.targetPolicies) {
    if (!policyAppliesToCommand(policy, cmd.command)) continue;
    if (policyMatches(policy, cmd, cwd)) {
      matching.push(policy);
    }
  }
  if (matching.length === 0) return null;
  let winningPolicy = matching[0];
  for (const policy of matching) {
    if (policy.decision === "deny") {
      winningPolicy = policy;
      break;
    }
    if (policy.decision === "ask" && winningPolicy.decision === "allow") {
      winningPolicy = policy;
    }
  }
  return {
    command: cmd.command,
    args: cmd.args,
    decision: winningPolicy.decision,
    reason: winningPolicy.reason ?? `target policy (${winningPolicy.type})`,
    matchedRule: `targetPolicy:${winningPolicy.type}`,
    resolvedFrom: cmd.resolvedFrom
  };
}

// src/evaluator.ts
function safeRegexTest(pattern, input) {
  try {
    return new RegExp(pattern).test(input);
  } catch {
    warn(`[warden] Warning: invalid regex pattern: ${pattern}
`);
    return false;
  }
}
function expandTilde(path) {
  return path.startsWith("~/") ? (0, import_os5.homedir)() + path.slice(1) : path;
}
function commandMatchesName(cmd, name) {
  if (name.includes("*")) {
    const expanded = expandTilde(name);
    const regexStr = pathGlobToRegex(expanded);
    try {
      const re = new RegExp(`^${regexStr}$`);
      const target = name.includes("/") ? expandTilde(cmd.originalCommand) : cmd.command;
      return re.test(target);
    } catch {
      return false;
    }
  }
  if (name.startsWith("/")) {
    return expandTilde(cmd.originalCommand) === name;
  }
  if (name.startsWith("~/")) {
    return expandTilde(cmd.originalCommand) === (0, import_os5.homedir)() + name.slice(1);
  }
  return cmd.command === name;
}
var MAX_RECURSION_DEPTH = 10;
function evaluate(parsed, config, depth = 0, cwd) {
  if (depth > MAX_RECURSION_DEPTH) {
    return { decision: "ask", reason: "too many nested commands", details: [] };
  }
  if (parsed.parseError) {
    return { decision: "ask", reason: "unparseable command", details: [] };
  }
  if (parsed.commands.length === 0) {
    return { decision: "allow", reason: "Empty command", details: [] };
  }
  if (parsed.hasSubshell && parsed.subshellCommands.length > 0) {
    for (const subCmd of parsed.subshellCommands) {
      const subParsed = parseCommand(subCmd);
      const subResult = evaluate(subParsed, config, depth + 1, cwd);
      if (subResult.decision === "deny") {
        return { decision: "deny", reason: `Subshell command: ${subResult.reason}`, details: subResult.details };
      }
      if (subResult.decision === "ask") {
        return { decision: "ask", reason: `Subshell command: ${subResult.reason}`, details: subResult.details };
      }
    }
  } else if (parsed.hasSubshell && parsed.subshellCommands.length === 0 && config.askOnSubshell) {
    return { decision: "ask", reason: "contains subshell", details: [] };
  }
  const details = [];
  for (const cmd of parsed.commands) {
    details.push(evaluateCommand(cmd, config, depth, parsed.chainAssignments, cwd));
  }
  const decisions = details.map((d) => d.decision);
  if (decisions.includes("deny")) {
    const denied = details.filter((d) => d.decision === "deny");
    return {
      decision: "deny",
      reason: denied.map((d) => `${d.command}: ${d.reason}`).join("; "),
      details
    };
  }
  if (decisions.includes("ask")) {
    const asked = details.filter((d) => d.decision === "ask");
    return {
      decision: "ask",
      reason: asked.map((d) => `${d.command}: ${d.reason}`).join("; "),
      details
    };
  }
  return { decision: "allow", reason: "ok", details };
}
function evaluateCommand(cmd, config, depth = 0, chainAssignments, cwd) {
  const { command, args } = cmd;
  const detail = (d) => {
    if (cmd.resolvedFrom) d.resolvedFrom = cmd.resolvedFrom;
    return d;
  };
  for (const layer of config.layers) {
    if (layer.alwaysDeny.some((name) => commandMatchesName(cmd, name))) {
      return detail({ command, args, decision: "deny", reason: "blocked by policy", matchedRule: "alwaysDeny" });
    }
    if (layer.alwaysAllow.some((name) => commandMatchesName(cmd, name))) {
      return detail({ command, args, decision: "allow", reason: "safe", matchedRule: "alwaysAllow" });
    }
  }
  if (cwd && config.targetPolicies?.length) {
    const targetResult = evaluateTargetPolicies(cmd, cwd, config);
    if (targetResult) return detail(targetResult);
  }
  if (cmd.resolvedFrom && chainAssignments && config.defaultDecision !== "deny") {
    const varMatch = cmd.resolvedFrom.match(/^\$\{?(\w+)\}?$/);
    if (varMatch) {
      const assignment = chainAssignments.get(varMatch[1]);
      if (assignment && !assignment.isDynamic && assignment.value !== null) {
        if (!collectMergedRule(cmd, config)) {
          return detail({ command, args, decision: "allow", reason: `chain-local binary (${assignment.value})`, matchedRule: "chainResolved" });
        }
      }
    }
  }
  if (cmd.originalPath && !cmd.originalPath.startsWith("/") && !cmd.originalPath.startsWith("~/") && config.defaultDecision !== "deny") {
    if (!collectMergedRule(cmd, config)) {
      return detail({ command, args, decision: "allow", reason: `local binary (${cmd.originalPath})`, matchedRule: "localBinary" });
    }
  }
  if (command === "rm" && cmd.effectiveCwd) {
    const tempResult = evaluateRmTempDir(cmd, config);
    if (tempResult) return detail(tempResult);
  }
  if (command === "rm" && chainAssignments?.size) {
    const rmResult = evaluateRmChainLocal(cmd, chainAssignments, config, cwd);
    if (rmResult) return detail(rmResult);
  }
  const remotes = config.trustedRemotes || [];
  if (command === "ssh" || command === "scp" || command === "rsync") {
    const targets = remotes.filter((t) => t.context === "ssh");
    if (targets.length) {
      const sshResult = evaluateSSHCommand(cmd, config, targets, depth);
      if (sshResult) return sshResult;
    }
  }
  if (command === "docker") {
    const targets = remotes.filter((t) => t.context === "docker");
    if (targets.length) {
      const dockerResult = evaluateDockerExec(cmd, config, targets, depth);
      if (dockerResult) return dockerResult;
    }
  }
  if (command === "kubectl") {
    const targets = remotes.filter((t) => t.context === "kubectl");
    if (targets.length) {
      const kubectlResult = evaluateKubectlExec(cmd, config, targets, depth);
      if (kubectlResult) return kubectlResult;
    }
  }
  if (command === "sprite") {
    const targets = remotes.filter((t) => t.context === "sprite");
    if (targets.length) {
      const spriteResult = evaluateSpriteExec(cmd, config, targets, depth);
      if (spriteResult) return spriteResult;
    }
  }
  if (command === "fly" || command === "flyctl") {
    const targets = remotes.filter((t) => t.context === "fly");
    if (targets.length) {
      const flyResult = evaluateFlyCommand(cmd, config, targets, depth);
      if (flyResult) return flyResult;
    }
  }
  if (command === "uv") {
    const uvResult = evaluateUvCommand(cmd, config, depth);
    if (uvResult) return uvResult;
  }
  if (command === "xargs") {
    return evaluateXargsCommand(cmd, config, depth);
  }
  if (command === "find") {
    return evaluateFindCommand(cmd, config, depth);
  }
  if (command === "npx" || command === "bunx" || command === "pnpx") {
    const pkgResult = evaluatePkgRunnerSubcommand(cmd, config, depth, cwd);
    if (pkgResult) return pkgResult;
  }
  if (command === "python" || command === "python3") {
    const pyResult = evaluatePythonCommand(cmd, config, depth, cwd);
    if (pyResult) return pyResult;
  }
  if (command === "node" || command === "tsx" || command === "ts-node") {
    const nodeResult = evaluateNodeCommand(cmd, config, depth, cwd);
    if (nodeResult) return nodeResult;
  }
  if (command === "perl") {
    const perlResult = evaluatePerlCommand(cmd, config, depth, cwd);
    if (perlResult) return perlResult;
  }
  const mergedRule = collectMergedRule(cmd, config);
  if (mergedRule) {
    return evaluateRule(cmd, mergedRule);
  }
  return { command, args, decision: config.defaultDecision, reason: "unknown command", matchedRule: "default" };
}
function isTempDir(path) {
  if (path === "/tmp" || path.startsWith("/tmp/")) return true;
  if (path === "/var/tmp" || path.startsWith("/var/tmp/")) return true;
  const envTmpdir = process.env.TMPDIR;
  if (envTmpdir) {
    const normalized = envTmpdir.endsWith("/") ? envTmpdir : envTmpdir + "/";
    if (path === envTmpdir || path.startsWith(normalized)) return true;
  }
  return false;
}
function evaluateRmTempDir(cmd, config) {
  const { command, args } = cmd;
  if (config.defaultDecision === "deny") return null;
  const hasRecursive = args.some((a) => /^-[a-zA-Z]*r[a-zA-Z]*$/.test(a));
  if (!hasRecursive) return null;
  if (!cmd.effectiveCwd || !isTempDir(cmd.effectiveCwd)) return null;
  const targets = args.filter((a) => !a.startsWith("-"));
  if (targets.length === 0) return null;
  for (const t of targets) {
    if (t.startsWith("/")) return null;
    if (t.includes("..")) return null;
  }
  for (const layer of config.layers) {
    const rule = layer.rules.find((r) => commandMatchesName(cmd, r.command));
    if (rule) {
      if (rule.default === "deny") return null;
      const ruleResult = evaluateRule(cmd, rule);
      if (ruleResult.decision === "deny") return null;
      break;
    }
  }
  return { command, args, decision: "allow", reason: `temp directory cleanup (${cmd.effectiveCwd})`, matchedRule: "tempDirRm" };
}
var VAR_REF_REGEX2 = /^"?\$\{?(\w+)\}?"?$/;
function extractVarName(text) {
  const m = text.match(VAR_REF_REGEX2);
  return m ? m[1] : null;
}
function evaluateRmChainLocal(cmd, chainAssignments, config, cwd) {
  const { command, args } = cmd;
  if (config.defaultDecision === "deny") return null;
  const hasRecursive = args.some((a) => /^-[a-zA-Z]*r[a-zA-Z]*$/.test(a));
  if (!hasRecursive) return null;
  const targets = args.filter((a) => !a.startsWith("-"));
  if (targets.length === 0) return null;
  for (const target of targets) {
    const varName = extractVarName(target);
    if (!varName) return null;
    if (!chainAssignments.has(varName)) return null;
  }
  for (const layer of config.layers) {
    const rule = layer.rules.find((r) => commandMatchesName(cmd, r.command));
    if (rule) {
      if (rule.default === "deny") return null;
      const ruleResult = evaluateRule(cmd, rule);
      if (ruleResult.decision === "deny") return null;
      break;
    }
  }
  if (cwd && config.targetPolicies?.length) {
    const resolvedArgs = args.map((arg) => {
      const varName = extractVarName(arg);
      if (varName) {
        const assignment = chainAssignments.get(varName);
        if (assignment?.value) return assignment.value;
      }
      return arg;
    });
    const resolvedCmd = { ...cmd, args: resolvedArgs };
    const targetResult = evaluateTargetPolicies(resolvedCmd, cwd, config);
    if (targetResult && targetResult.decision === "deny") {
      return { command, args, decision: "deny", reason: targetResult.reason, matchedRule: targetResult.matchedRule };
    }
  }
  return { command, args, decision: "allow", reason: "chain-local cleanup", matchedRule: "chainLocalRm" };
}
function collectMergedRule(cmd, config) {
  const matchingRules = [];
  for (const layer of config.layers) {
    const rule = layer.rules.find((r) => commandMatchesName(cmd, r.command));
    if (rule) {
      matchingRules.push(rule);
      if (rule.override) break;
    }
  }
  if (matchingRules.length === 0) return null;
  if (matchingRules.length === 1) return matchingRules[0];
  const mergedPatterns = [];
  for (const rule of matchingRules) {
    if (rule.argPatterns) {
      mergedPatterns.push(...rule.argPatterns);
    }
  }
  return {
    command: matchingRules[0].command,
    default: matchingRules[0].default,
    argPatterns: mergedPatterns
  };
}
function evaluateRule(cmd, rule) {
  const { command, args } = cmd;
  const argsJoined = args.join(" ");
  for (const pattern of rule.argPatterns || []) {
    const m = pattern.match;
    let matched = true;
    if (m.noArgs !== void 0) {
      matched = matched && m.noArgs === (args.length === 0);
    }
    if (m.argsMatch && matched) {
      matched = m.argsMatch.some((re) => safeRegexTest(re, argsJoined));
    }
    if (m.anyArgMatches && matched) {
      matched = args.some((arg) => m.anyArgMatches.some((re) => safeRegexTest(re, arg)));
    }
    if (m.argCount && matched) {
      if (m.argCount.min !== void 0) matched = matched && args.length >= m.argCount.min;
      if (m.argCount.max !== void 0) matched = matched && args.length <= m.argCount.max;
    }
    if (m.not) matched = !matched;
    if (matched) {
      return {
        command,
        args,
        decision: pattern.decision,
        reason: pattern.reason || pattern.description || `Matched pattern for "${command}"`,
        matchedRule: `${command}:argPattern`
      };
    }
  }
  return {
    command,
    args,
    decision: rule.default,
    reason: "needs review",
    matchedRule: `${command}:default`
  };
}
var UV_RUN_FLAGS_WITH_VALUE = /* @__PURE__ */ new Set([
  "--with",
  "--from",
  "--python",
  "--package",
  "--index",
  "--extra-index-url",
  "--cache-dir",
  "--index-strategy",
  "--keyring-provider"
]);
var UV_RUN_FLAGS_NO_VALUE = /* @__PURE__ */ new Set([
  "--no-cache",
  "--locked",
  "--frozen",
  "--isolated",
  "--verbose",
  "--quiet",
  "--no-project"
]);
function parseUvRunSubcommand(args) {
  let i = 1;
  while (i < args.length) {
    const arg = args[i];
    if (arg === "--") {
      i++;
      break;
    }
    if (!arg.startsWith("-")) {
      break;
    }
    if (arg.startsWith("--") && arg.includes("=")) {
      const flagName = arg.slice(0, arg.indexOf("="));
      if (UV_RUN_FLAGS_WITH_VALUE.has(flagName) || UV_RUN_FLAGS_NO_VALUE.has(flagName)) {
        i++;
        continue;
      }
      return { subcommand: null, unresolved: true };
    }
    if (UV_RUN_FLAGS_WITH_VALUE.has(arg)) {
      if (i + 1 >= args.length) return { subcommand: null, unresolved: true };
      i += 2;
      continue;
    }
    if (UV_RUN_FLAGS_NO_VALUE.has(arg)) {
      i++;
      continue;
    }
    return { subcommand: null, unresolved: true };
  }
  if (i >= args.length) {
    return { subcommand: null, unresolved: false };
  }
  const subcmd = args[i];
  const subArgs = args.slice(i + 1);
  return {
    unresolved: false,
    subcommand: {
      command: subcmd.includes("/") ? subcmd.split("/").pop() : subcmd,
      originalCommand: subcmd,
      args: subArgs,
      envPrefixes: [],
      raw: [subcmd, ...subArgs].join(" ")
    }
  };
}
function evaluateUvCommand(cmd, config, depth = 0) {
  const { command, args } = cmd;
  if (args[0] !== "run") return null;
  const { subcommand, unresolved } = parseUvRunSubcommand(args);
  if (unresolved || !subcommand) {
    if (unresolved) {
      return {
        command,
        args,
        decision: "ask",
        reason: "uv run: inner command could not be resolved safely",
        matchedRule: "uv:run"
      };
    }
    return null;
  }
  const parsed = {
    commands: [subcommand],
    hasSubshell: false,
    subshellCommands: [],
    parseError: false,
    chainAssignments: /* @__PURE__ */ new Map()
  };
  const result = evaluate(parsed, config, depth + 1);
  return {
    command,
    args,
    decision: result.decision,
    reason: `uv run: ${result.reason}`,
    matchedRule: "uv:run"
  };
}
var XARGS_SHORT_FLAGS_WITH_VALUE = /* @__PURE__ */ new Set(["E", "I", "L", "n", "P", "s", "S", "d", "a"]);
var XARGS_SHORT_FLAGS_NO_VALUE = /* @__PURE__ */ new Set(["0", "e", "o", "p", "r", "t", "x"]);
var XARGS_LONG_FLAGS_WITH_VALUE = /* @__PURE__ */ new Set([
  "--eof",
  "--replace",
  "--max-lines",
  "--max-args",
  "--max-procs",
  "--max-chars",
  "--arg-file",
  "--delimiter"
]);
var XARGS_LONG_FLAGS_NO_VALUE = /* @__PURE__ */ new Set([
  "--null",
  "--exit",
  "--open-tty",
  "--interactive",
  "--no-run-if-empty",
  "--verbose",
  "--show-limits"
]);
function parseXargsSubcommand(args) {
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === "--") {
      i++;
      break;
    }
    if (!arg.startsWith("-") || arg === "-") {
      break;
    }
    if (arg.startsWith("--")) {
      const eqIndex = arg.indexOf("=");
      const longFlag = eqIndex === -1 ? arg : arg.slice(0, eqIndex);
      if (XARGS_LONG_FLAGS_WITH_VALUE.has(longFlag)) {
        if (eqIndex !== -1) {
          i++;
          continue;
        }
        if (i + 1 >= args.length) return { subcommand: null, unresolved: true };
        i += 2;
        continue;
      }
      if (XARGS_LONG_FLAGS_NO_VALUE.has(longFlag)) {
        i++;
        continue;
      }
      return { subcommand: null, unresolved: true };
    }
    const short = arg[1];
    if (XARGS_SHORT_FLAGS_WITH_VALUE.has(short)) {
      if (arg.length > 2) {
        i++;
        continue;
      }
      if (i + 1 >= args.length) return { subcommand: null, unresolved: true };
      i += 2;
      continue;
    }
    const grouped = arg.slice(1).split("");
    const allKnownNoValue = grouped.every((ch) => XARGS_SHORT_FLAGS_NO_VALUE.has(ch));
    if (allKnownNoValue) {
      i++;
      continue;
    }
    return { subcommand: null, unresolved: true };
  }
  if (i >= args.length) {
    return {
      unresolved: false,
      subcommand: {
        command: "echo",
        originalCommand: "echo",
        args: [],
        envPrefixes: [],
        raw: "echo"
      }
    };
  }
  const subcommand = args[i];
  const subArgs = args.slice(i + 1);
  return {
    unresolved: false,
    subcommand: {
      command: subcommand,
      originalCommand: subcommand,
      args: subArgs,
      envPrefixes: [],
      raw: [subcommand, ...subArgs].join(" ")
    }
  };
}
function evaluateXargsCommand(cmd, config, depth = 0) {
  const { command, args } = cmd;
  const { subcommand, unresolved } = parseXargsSubcommand(args);
  if (unresolved || !subcommand) {
    return {
      command,
      args,
      decision: "ask",
      reason: "xargs subcommand could not be resolved safely",
      matchedRule: "xargs:subcommand"
    };
  }
  const isShellExec = (subcommand.command === "sh" || subcommand.command === "bash" || subcommand.command === "zsh") && subcommand.args.length >= 2 && subcommand.args[0] === "-c";
  let parsed;
  if (isShellExec) {
    const innerResult = parseCommand(subcommand.args[1]);
    if (innerResult.parseError) {
      parsed = { commands: [subcommand], hasSubshell: false, subshellCommands: [], parseError: false, chainAssignments: /* @__PURE__ */ new Map() };
    } else {
      parsed = innerResult;
    }
  } else {
    parsed = { commands: [subcommand], hasSubshell: false, subshellCommands: [], parseError: false, chainAssignments: /* @__PURE__ */ new Map() };
  }
  const result = evaluate(parsed, config, depth + 1);
  return {
    command,
    args,
    decision: result.decision,
    reason: `xargs subcommand "${subcommand.command}": ${result.reason}`,
    matchedRule: "xargs:subcommand"
  };
}
function parseFindExecCommands(args) {
  const commands = [];
  let i = 0;
  while (i < args.length) {
    if (args[i] === "-exec" || args[i] === "-execdir") {
      i++;
      const cmdArgs = [];
      while (i < args.length && args[i] !== ";" && args[i] !== "+") {
        if (args[i] !== "{}") {
          cmdArgs.push(args[i]);
        }
        i++;
      }
      i++;
      if (cmdArgs.length > 0) {
        commands.push({
          command: cmdArgs[0],
          originalCommand: cmdArgs[0],
          args: cmdArgs.slice(1),
          envPrefixes: [],
          raw: cmdArgs.join(" ")
        });
      }
    } else {
      i++;
    }
  }
  return commands;
}
function evaluateFindCommand(cmd, config, depth = 0) {
  const { command, args } = cmd;
  if (args.some((a) => a === "-delete")) {
    return { command, args, decision: "ask", reason: "find -delete can remove files", matchedRule: "find:delete" };
  }
  if (args.some((a) => a === "-ok" || a === "-okdir")) {
    return { command, args, decision: "ask", reason: "find -ok/-okdir can execute commands interactively", matchedRule: "find:ok" };
  }
  const execCommands = parseFindExecCommands(args);
  if (execCommands.length === 0) {
    return { command, args, decision: "allow", reason: "find without dangerous flags", matchedRule: "find:safe" };
  }
  for (const execCmd of execCommands) {
    const parsed = {
      commands: [execCmd],
      hasSubshell: false,
      subshellCommands: [],
      parseError: false,
      chainAssignments: /* @__PURE__ */ new Map()
    };
    const result = evaluate(parsed, config, depth + 1);
    if (result.decision === "deny") {
      return { command, args, decision: "deny", reason: `find -exec: ${result.reason}`, matchedRule: "find:exec" };
    }
    if (result.decision === "ask") {
      return { command, args, decision: "ask", reason: `find -exec: ${result.reason}`, matchedRule: "find:exec" };
    }
  }
  return { command, args, decision: "allow", reason: "find -exec commands are safe", matchedRule: "find:exec" };
}
var SSH_FLAGS_WITH_VALUE = /* @__PURE__ */ new Set([
  "-b",
  "-c",
  "-D",
  "-E",
  "-e",
  "-F",
  "-I",
  "-i",
  "-J",
  "-L",
  "-l",
  "-m",
  "-O",
  "-o",
  "-p",
  "-Q",
  "-R",
  "-S",
  "-W",
  "-w"
]);
function findMatchingTarget(value, targets) {
  return targets.find((t) => globToRegex(t.name).test(value)) || null;
}
function parseSSHArgs(args) {
  let host = null;
  const remoteArgs = [];
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (SSH_FLAGS_WITH_VALUE.has(arg)) {
      i += 2;
      continue;
    }
    if (arg.startsWith("-")) {
      i++;
      continue;
    }
    if (!host) {
      host = arg.includes("@") ? arg.split("@").pop() : arg;
      i++;
      while (i < args.length) {
        remoteArgs.push(args[i]);
        i++;
      }
      break;
    }
    i++;
  }
  return {
    host,
    remoteCommand: remoteArgs.length > 0 ? remoteArgs.map(shellQuote).join(" ") : null
  };
}
function extractHostFromRemotePath(args) {
  for (const arg of args) {
    const match = arg.match(/^(?:[^@]+@)?([^:]+):/);
    if (match) return match[1];
  }
  return null;
}
function evaluateSSHCommand(cmd, config, targets, depth = 0) {
  const { command, args } = cmd;
  const trustedHosts = targets;
  if (command === "scp" || command === "rsync") {
    const host2 = extractHostFromRemotePath(args);
    if (!host2) return null;
    const target2 = findMatchingTarget(host2, trustedHosts);
    if (!target2) return null;
    if (target2.allowAll || !target2.overrides) {
      return {
        command,
        args,
        decision: "allow",
        reason: `Trusted SSH host "${host2}"${target2.allowAll ? " (allowAll)" : ""}`,
        matchedRule: "trustedRemotes:ssh"
      };
    }
    if (target2.overrides.alwaysDeny.some((name) => name === command)) {
      return {
        command,
        args,
        decision: "deny",
        reason: `Trusted SSH host "${host2}": "${command}" blocked by overrides`,
        matchedRule: "trustedRemotes:ssh"
      };
    }
    return {
      command,
      args,
      decision: "allow",
      reason: `Trusted SSH host "${host2}"`,
      matchedRule: "trustedRemotes:ssh"
    };
  }
  const { host, remoteCommand } = parseSSHArgs(args);
  if (!host) return null;
  const target = findMatchingTarget(host, trustedHosts);
  if (!target) return null;
  if (!remoteCommand) {
    return {
      command,
      args,
      decision: "allow",
      reason: `Trusted SSH host "${host}" (interactive)`,
      matchedRule: "trustedRemotes:ssh"
    };
  }
  if (target.allowAll) {
    return {
      command,
      args,
      decision: "allow",
      reason: `Trusted SSH host "${host}" (allowAll)`,
      matchedRule: "trustedRemotes:ssh"
    };
  }
  const parsed = parseCommand(remoteCommand);
  const result = evaluate(parsed, configWithContextOverrides(config, target), depth + 1);
  return {
    command,
    args,
    decision: result.decision,
    reason: `Trusted SSH host "${host}": ${result.reason}`,
    matchedRule: "trustedRemotes:ssh"
  };
}
var DOCKER_EXEC_FLAGS_WITH_VALUE = /* @__PURE__ */ new Set([
  "-e",
  "--env",
  "--env-file",
  "-u",
  "--user",
  "-w",
  "--workdir",
  "--detach-keys"
]);
var INTERACTIVE_SHELLS = /* @__PURE__ */ new Set(["bash", "sh", "zsh"]);
function shellQuote(arg) {
  if (/[\s"'\\$`!#&|;()<>]/.test(arg)) {
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }
  return arg;
}
function configWithContextOverrides(config, target) {
  const overrideLayers = [];
  if (target?.overrides) overrideLayers.push(target.overrides);
  if (config.trustedContextOverrides) overrideLayers.push(config.trustedContextOverrides);
  if (overrideLayers.length === 0) return config;
  return {
    ...config,
    layers: [...overrideLayers, ...config.layers]
  };
}
function evaluateRemoteCommand(remoteArgs, config, target, depth = 0) {
  if (target?.allowAll) {
    return { decision: "allow", reason: "allowAll target", details: [] };
  }
  const overriddenConfig = configWithContextOverrides(config, target);
  if (remoteArgs.length === 0) {
    return { decision: "allow", reason: "interactive", details: [] };
  }
  const remoteCmd = remoteArgs[0];
  if (INTERACTIVE_SHELLS.has(remoteCmd) && remoteArgs.length === 1) {
    return { decision: "allow", reason: "interactive shell", details: [] };
  }
  if (INTERACTIVE_SHELLS.has(remoteCmd) && remoteArgs[1] === "-c" && remoteArgs.length >= 3) {
    const innerCommand = remoteArgs.slice(2).join(" ");
    const parsed2 = parseCommand(innerCommand);
    return evaluate(parsed2, overriddenConfig, depth + 1);
  }
  const parsed = {
    commands: [{ command: remoteCmd, originalCommand: remoteCmd, args: remoteArgs.slice(1), envPrefixes: [], raw: remoteArgs.join(" ") }],
    hasSubshell: false,
    subshellCommands: [],
    parseError: false,
    chainAssignments: /* @__PURE__ */ new Map()
  };
  return evaluate(parsed, overriddenConfig, depth + 1);
}
function parseDockerExecArgs(args) {
  let target = null;
  const remoteArgs = [];
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (DOCKER_EXEC_FLAGS_WITH_VALUE.has(arg)) {
      i += 2;
      continue;
    }
    if (arg.startsWith("-")) {
      i++;
      continue;
    }
    if (!target) {
      target = arg;
      i++;
      while (i < args.length) {
        remoteArgs.push(args[i]);
        i++;
      }
      break;
    }
    i++;
  }
  return { target, remoteArgs };
}
function evaluateDockerExec(cmd, config, targets, depth = 0) {
  const { command, args } = cmd;
  if (args[0] !== "exec") return null;
  const { target: containerName, remoteArgs } = parseDockerExecArgs(args.slice(1));
  if (!containerName) return null;
  const matched = findMatchingTarget(containerName, targets);
  if (!matched) return null;
  const result = evaluateRemoteCommand(remoteArgs, config, matched, depth);
  return {
    command,
    args,
    decision: result.decision,
    reason: `Trusted Docker container "${containerName}" (${result.reason})`,
    matchedRule: "trustedRemotes:docker"
  };
}
var KUBECTL_FLAGS_WITH_VALUE = /* @__PURE__ */ new Set([
  "-n",
  "--namespace",
  "-c",
  "--container",
  "--context",
  "--cluster",
  "--kubeconfig",
  "-s",
  "--server",
  "--token",
  "--user",
  "--as",
  "--as-group",
  "--certificate-authority",
  "--client-certificate",
  "--client-key",
  "-l",
  "--selector",
  "-f",
  "--filename",
  "--cache-dir",
  "--request-timeout",
  "-o",
  "--output"
]);
function parseKubectlExecArgs(args) {
  let context = null;
  let pod = null;
  const remoteArgs = [];
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === "--") {
      i++;
      while (i < args.length) {
        remoteArgs.push(args[i]);
        i++;
      }
      break;
    }
    if (arg.startsWith("--") && arg.includes("=")) {
      if (arg.startsWith("--context=")) {
        context = arg.split("=")[1];
      }
      i++;
      continue;
    }
    if (KUBECTL_FLAGS_WITH_VALUE.has(arg)) {
      if (arg === "--context") context = args[i + 1] || null;
      i += 2;
      continue;
    }
    if (arg.startsWith("-")) {
      i++;
      continue;
    }
    if (!pod) {
      pod = arg;
    }
    i++;
  }
  return { context, pod, remoteArgs };
}
function evaluateKubectlExec(cmd, config, targets, depth = 0) {
  const { command, args } = cmd;
  if (args[0] !== "exec") return null;
  const { context, pod, remoteArgs } = parseKubectlExecArgs(args.slice(1));
  if (!context) return null;
  const matched = findMatchingTarget(context, targets);
  if (!matched) return null;
  const result = evaluateRemoteCommand(remoteArgs, config, matched, depth);
  return {
    command,
    args,
    decision: result.decision,
    reason: `Trusted kubectl context "${context}"${pod ? `, pod "${pod}"` : ""} (${result.reason})`,
    matchedRule: "trustedRemotes:kubectl"
  };
}
var SPRITE_FLAGS_WITH_VALUE = /* @__PURE__ */ new Set([
  "-o",
  "--org",
  "-s",
  "--sprite"
]);
function parseSpriteExecArgs(args) {
  let spriteName = null;
  const remoteArgs = [];
  let foundExec = false;
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith("--") && arg.includes("=")) {
      if (arg.startsWith("--sprite=")) {
        spriteName = arg.split("=")[1];
      }
      i++;
      continue;
    }
    if (SPRITE_FLAGS_WITH_VALUE.has(arg)) {
      if (arg === "-s" || arg === "--sprite") {
        spriteName = args[i + 1] || null;
      }
      i += 2;
      continue;
    }
    if (arg === "--debug") {
      i++;
      continue;
    }
    if (arg.startsWith("-")) {
      i++;
      continue;
    }
    if (!foundExec) {
      if (arg === "exec" || arg === "x" || arg === "console" || arg === "c") {
        foundExec = true;
        i++;
        continue;
      }
      return { spriteName: null, remoteArgs: [] };
    }
    while (i < args.length) {
      remoteArgs.push(args[i]);
      i++;
    }
    break;
  }
  return { spriteName, remoteArgs };
}
function evaluateSpriteExec(cmd, config, targets, depth = 0) {
  const { command, args } = cmd;
  const { spriteName, remoteArgs } = parseSpriteExecArgs(args);
  if (!spriteName) return null;
  const matched = findMatchingTarget(spriteName, targets);
  if (!matched) return null;
  const result = evaluateRemoteCommand(remoteArgs, config, matched, depth);
  return {
    command,
    args,
    decision: result.decision,
    reason: `Trusted sprite "${spriteName}" (${result.reason})`,
    matchedRule: "trustedRemotes:sprite"
  };
}
var FLY_SSH_FLAGS_WITH_VALUE = /* @__PURE__ */ new Set([
  "-a",
  "--app",
  "-C",
  "--command",
  "-o",
  "--org",
  "-r",
  "--region",
  "-u",
  "--user",
  "--address"
]);
function parseFlySSHArgs(args) {
  let app = null;
  const remoteArgs = [];
  let isSSH = false;
  let foundConsole = false;
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith("--app=")) {
      app = arg.slice(6);
      i++;
      continue;
    }
    if (FLY_SSH_FLAGS_WITH_VALUE.has(arg)) {
      if (arg === "-a" || arg === "--app") {
        app = args[i + 1] || null;
      }
      if ((arg === "-C" || arg === "--command") && foundConsole) {
        const cmdValue = args[i + 1];
        if (cmdValue) {
          const parsed = parseCommand(cmdValue);
          if (!parsed.parseError && parsed.commands.length > 0) {
            const cmd = parsed.commands[0];
            remoteArgs.push(cmd.command, ...cmd.args);
          }
        }
        i += 2;
        continue;
      }
      i += 2;
      continue;
    }
    if (arg === "--") {
      i++;
      while (i < args.length) {
        remoteArgs.push(args[i]);
        i++;
      }
      break;
    }
    if (arg.startsWith("-")) {
      i++;
      continue;
    }
    if (!isSSH && arg === "ssh") {
      isSSH = true;
      i++;
      continue;
    }
    if (isSSH && !foundConsole && (arg === "console" || arg === "sftp")) {
      foundConsole = true;
      i++;
      continue;
    }
    i++;
  }
  return { app, remoteArgs, isSSH: isSSH && foundConsole };
}
function evaluateFlyCommand(cmd, config, targets, depth = 0) {
  const { command, args } = cmd;
  const { app, remoteArgs, isSSH } = parseFlySSHArgs(args);
  if (!isSSH) return null;
  if (!app) return null;
  const matched = findMatchingTarget(app, targets);
  if (!matched) return null;
  const result = evaluateRemoteCommand(remoteArgs, config, matched, depth);
  return {
    command,
    args,
    decision: result.decision,
    reason: `Trusted Fly app "${app}" (${result.reason})`,
    matchedRule: "trustedRemotes:fly"
  };
}
var COMMANDS_WITH_SCRIPT_EVALUATORS = /* @__PURE__ */ new Set(["node", "tsx", "ts-node", "python", "python3", "perl"]);
function evaluatePkgRunnerSubcommand(cmd, config, depth, cwd) {
  const { command, args } = cmd;
  let i = 0;
  while (i < args.length) {
    if (args[i] === "--package" || args[i] === "-p" || args[i] === "--call" || args[i] === "-c") {
      i += 2;
      continue;
    }
    if (args[i].startsWith("-")) {
      i++;
      continue;
    }
    break;
  }
  if (i >= args.length) return null;
  const subcmd = args[i];
  if (!COMMANDS_WITH_SCRIPT_EVALUATORS.has(subcmd)) return null;
  const subArgs = args.slice(i + 1);
  const subParsedCmd = {
    command: subcmd,
    originalCommand: subcmd,
    args: subArgs,
    envPrefixes: [],
    raw: [subcmd, ...subArgs].join(" ")
  };
  const subResult = evaluateCommand(subParsedCmd, config, depth + 1, void 0, cwd);
  return {
    command,
    args,
    decision: subResult.decision,
    reason: `${command} ${subcmd}: ${subResult.reason}`,
    matchedRule: `${command}:subcommand`
  };
}
function userRulesWouldRestrict(cmd, config) {
  const rule = collectMergedRule(cmd, config);
  return !!rule && rule.default === "deny";
}
function mapScanResult(cmd, scanResult, matchedRule, config) {
  if (!scanResult) {
    if (userRulesWouldRestrict(cmd, config)) return null;
    return { command: cmd.command, args: cmd.args, decision: "allow", reason: "script content is safe", matchedRule };
  }
  const reason = scanResult.level === "dangerous" ? `dangerous: ${scanResult.reason}` : scanResult.reason;
  return { command: cmd.command, args: cmd.args, decision: "ask", reason, matchedRule };
}
function scanScriptFile(cmd, filePath, language, matchedRule, config, cwd) {
  const fileResult = readScriptFile(filePath, cwd || process.cwd());
  if ("error" in fileResult) {
    return { command: cmd.command, args: cmd.args, decision: "ask", reason: fileResult.error, matchedRule };
  }
  return mapScanResult(cmd, scanScriptCode(fileResult.content, language), matchedRule, config);
}
var SAFE_PYTHON_MODULES = /* @__PURE__ */ new Set([
  "pytest",
  "unittest",
  "venv",
  "pip",
  "json.tool",
  "compileall",
  "pydoc",
  "doctest",
  "timeit",
  "py_compile",
  "black",
  "ruff",
  "mypy",
  "isort",
  "ensurepip",
  "zipfile",
  "site",
  "cProfile",
  "pdb",
  "dis",
  "ast",
  "tokenize",
  "sysconfig"
]);
function evaluatePythonCommand(cmd, config, depth = 0, cwd) {
  const { command, args } = cmd;
  const rule = "python:script";
  if (args.some((a) => a === "--version" || a === "--help" || a === "-V")) {
    return { command, args, decision: "allow", reason: "version/help flag", matchedRule: rule };
  }
  const cIdx = args.indexOf("-c");
  if (cIdx !== -1) {
    const code = args[cIdx + 1];
    if (!code) {
      return { command, args, decision: "ask", reason: "missing code after -c", matchedRule: rule };
    }
    return mapScanResult(cmd, scanScriptCode(code, "python"), rule, config);
  }
  const mIdx = args.indexOf("-m");
  if (mIdx !== -1) {
    const mod = args[mIdx + 1];
    if (!mod) {
      return { command, args, decision: "ask", reason: "missing module after -m", matchedRule: rule };
    }
    if (SAFE_PYTHON_MODULES.has(mod)) {
      if (userRulesWouldRestrict(cmd, config)) return null;
      return { command, args, decision: "allow", reason: `safe module: ${mod}`, matchedRule: rule };
    }
    return { command, args, decision: "ask", reason: `unknown module: ${mod}`, matchedRule: rule };
  }
  const scriptArg = args.find((a) => !a.startsWith("-") && a.endsWith(".py"));
  if (scriptArg) {
    return scanScriptFile(cmd, scriptArg, "python", rule, config, cwd);
  }
  if (args.length === 0) {
    return { command, args, decision: "ask", reason: "opens interactive REPL", matchedRule: rule };
  }
  return null;
}
var NODE_SCRIPT_EXTENSIONS = /\.(js|mjs|cjs|ts|mts|cts|tsx|jsx)$/;
function evaluateNodeCommand(cmd, config, depth = 0, cwd) {
  const { command, args } = cmd;
  const rule = "node:script";
  if (args.some((a) => a === "--version" || a === "--help" || a === "-v" || a === "-h")) {
    return { command, args, decision: "allow", reason: "version/help flag", matchedRule: rule };
  }
  const evalIdx = args.findIndex((a) => a === "-e" || a === "--eval" || a === "-p" || a === "--print");
  if (evalIdx !== -1) {
    const code = args[evalIdx + 1];
    if (!code) {
      return { command, args, decision: "ask", reason: "missing code after eval flag", matchedRule: rule };
    }
    return mapScanResult(cmd, scanScriptCode(code, "typescript"), rule, config);
  }
  const scriptArg = args.find((a) => !a.startsWith("-") && NODE_SCRIPT_EXTENSIONS.test(a));
  if (scriptArg) {
    return scanScriptFile(cmd, scriptArg, "typescript", rule, config, cwd);
  }
  if (args.length === 0) {
    return { command, args, decision: "ask", reason: "opens interactive REPL", matchedRule: rule };
  }
  return null;
}
function evaluatePerlCommand(cmd, config, depth = 0, cwd) {
  const { command, args } = cmd;
  const rule = "perl:script";
  if (args.some((a) => a === "--version" || a === "--help" || a === "-v")) {
    return { command, args, decision: "allow", reason: "version/help flag", matchedRule: rule };
  }
  const eIdx = args.findIndex((a) => a === "-e" || a === "-E");
  if (eIdx !== -1) {
    const code = args[eIdx + 1];
    if (!code) {
      return { command, args, decision: "ask", reason: "missing code after -e", matchedRule: rule };
    }
    return mapScanResult(cmd, scanScriptCode(code, "perl"), rule, config);
  }
  const scriptArg = args.find((a) => !a.startsWith("-") && (a.endsWith(".pl") || a.endsWith(".pm")));
  if (scriptArg) {
    return scanScriptFile(cmd, scriptArg, "perl", rule, config, cwd);
  }
  if (args.length === 0) {
    return { command, args, decision: "ask", reason: "opens interactive REPL", matchedRule: rule };
  }
  return null;
}

// src/core.ts
function wardenEval(command, options) {
  const config = loadConfig(options?.cwd);
  return wardenEvalWithConfig(command, config, options?.cwd);
}
function wardenEvalWithConfig(command, config, cwd) {
  const parsed = parseCommand(command);
  return evaluate(parsed, config, 0, cwd);
}

// src/copilot.ts
var MAX_STDIN_SIZE = 1024 * 1024;
function output(decision, reason) {
  const result = {
    permissionDecision: decision,
    permissionDecisionReason: reason
  };
  process.stdout.write(JSON.stringify(result));
}
async function main() {
  let raw = "";
  for await (const chunk of process.stdin) {
    raw += chunk;
    if (raw.length > MAX_STDIN_SIZE) {
      output("ask", "[warden] Input exceeds size limit");
      process.exit(0);
    }
  }
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }
  if (input.toolName !== "bash") {
    process.exit(0);
  }
  let command;
  try {
    const args = JSON.parse(input.toolArgs);
    command = args.command;
  } catch {
    process.exit(0);
  }
  if (!command || typeof command !== "string") {
    process.exit(0);
  }
  const result = wardenEval(command, { cwd: input.cwd });
  output(result.decision, `[warden] ${result.reason}`);
  process.exit(0);
}
main().catch(() => process.exit(0));
