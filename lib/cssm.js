/**
 * @namespace CSS минимизатор.
 */
var $cssm = {

    /**
     * Проверяет, является ли строка комментарием.
     *
     * @param {String} s строка для проверки
     *
     * @returns {Boolean} если комментарий, true, иначе false
     */
    isComment: function(s) {
        return s.length > 3 && s.substr(0, 2) === '/*' && s.slice(-2) === '*/';
    },

    /**
     * Минимизирует CSS-дерево.
     *
     * @param {Object} tree дерево для минимизации
     * @param {Object} config настройки минимизации
     *
     * @returns {Object} минимизированное дерево
     */
    minimize: function(tree, config) {
        var nodes = [];
        config = config || {};

        $cssm.copyTree(tree, nodes);
        $cssm.processComments(nodes);
        $cssm.minimizeNodes(nodes);
        !(config.dontRestructure) && (nodes = $cssm.safe(nodes));

        return { nodes: nodes };
    },

    /**
     * Минимизирует подготовленные для минимизации узлы дерева.
     *
     * @param {Object[]} nodes узлы для минимизации
     */
    minimizeNodes: function(nodes) {
        var i, node;

        for (i = 0; i < nodes.length; i++) {
            node = nodes[i];
            if (node.type === 'ruleset') {
                node.value.forEach(function(value) {
                    $cssm.minTokens(value); // exclude URLs, etc
                });
                node.content.forEach(function(d) {
                    $cssm.minTokens(d.value); // exclude URLs, etc
                    if (d.name.join() === 'font-weight') $cssm.minFontWeight(d.value);
                });
            } else if (node.type === 'atrule' && node.value[1] === 'media') {
                $cssm.minimizeNodes(node.nodes);
            }

            if (node.nodes.length) $cssm.minimizeNodes(node.nodes);
        }
    },


    /**
     * Удаляет комментарии и обрабатывает конфигурационные комментарии.
     *
     * @param {Object[]} nodes узлы для обработки
     */
    processComments: function(nodes) {
        var node, i = 0, j, c, t, mode = { protect: false, order: false };

        for (; i < nodes.length; i++) {
            node = nodes[i];
            if (typeof node === 'string') {
                $cssm.checkMode(node, mode);
                nodes.splice(i, 1);
                i--;
            } else {
                if (node.value.length) {
                    node.value.forEach(function(value) {
                        $cssm.cleanComments(value);
                    });
                }
                if (node.content.length) {
                    for (j = 0; j < node.content.length; j++) {
                        c = node.content[j];
                        if (typeof c === 'string') {
                            $cssm.checkMode(c, mode);
                            if (!mode.protect && c === '/*p*/') {
                                if ((t = node.content[j + 1]) !== undefined && typeof t !== 'string') t.protect = true;
                            } else if (!mode.order && c === '/*o*/') {
                                if ((t = node.content[j + 1]) !== undefined && typeof t !== 'string') t.order = true;
                            }

                            node.content.splice(j--, 1);
                        } else {
                            if (mode.protect) c.protect = true;
                            if (!mode.order && !c.order) c.n = c.n - 1000000;
                            $cssm.cleanComments(c.name);
                            $cssm.cleanComments(c.value);
                        }
                    }
                }
                if (node.nodes && node.nodes.length) $cssm.processComments(node.nodes);
            }
        }
    },

    /**
     * Меняет режим защиты свойств, если переданный комментарий является конфигурационным.
     *
     * @param {String} s комментарий для обработки
     * @param {Object} mode режим для смены
     */
    checkMode: function(s, mode) {
        switch (s) {
            case '/*p<*/':
                mode.protect = true;
                break;
            case '/*>p*/':
                mode.protect = false;
                break;
            case '/*o<*/':
                mode.order = true;
                break;
            case '/*>o*/':
                mode.order = false;
                break;
            case '/*>op*/':
            case '/*>po*/':
                mode.protect = false;
                mode.order = false;
                break;
            case '/*op<*/':
            case '/*po<*/':
                mode.protect = true;
                mode.order = true;
                break;
        }
    },

    /**
     * Удаляет комментарии в массиве токенов.
     *
     * @param tokens токены с комментариями
     */
    cleanComments: function(tokens) {
        for (var i = 0; i < tokens.length; i++) {
            if ($cssm.isComment(tokens[i])) {
                if (tokens[i + 1] === ' ') tokens.splice(i + 1, 1);
                if (tokens[i - 1] === ' ') tokens.splice(i--, 1);
                tokens[i] = ' ';
                if (i === tokens.length - 1 || i === 0) tokens.splice(i, 1);
            }
        }
    },

    /**
     * Копирует CSS-дерево со всем содержимым, попутно пропуская ошибочные узлы.
     *
     * @param {Object} src исходное дерево
     * @param {[]} dst принимающий массив, может быть не указан
     *
     * @returns {Object[]} массив скопированных узлов дерева
     */
    copyTree: function(src, dst) {
        var r = dst || [], t,
            skipCharset = false, // CSS 2.1 / 4.1.5 At-rules
            skipImport = false, // CSS 2.1 / 4.1.5 At-rules
            node,
            n = 1,
            i = 0;

        function pushOneLineAtrule(node, r) {
            if (!node.content.length && !node.nodes.length) {
                r.push({ type: 'atrule', value: node.value.slice(), content: [], nodes: [] });
            }
        }

        for (; i < src.nodes.length; i++) {
            node = src.nodes[i];
            if (typeof node === 'string') {
                r.push(node);
            } else if ($cssm.isContentNode(node)) {
                if (node.value.length && node.content.length) {
                    t = { type: node.type, value: node.value.slice(), content: [], nodes: [] };
                    node.content.forEach(function(d) {
                        if (typeof d === 'string') t.content.push(d);
                        else if (d.name.length && d.value.length) t.content.push({ name: d.name.slice(), value: d.value.slice(), important: d.important, n: n, id: n++ });
                    });
                    r.push(t);
                    skipCharset = skipImport = true;
                }
            } else {
                switch (node.value[1]) {
                    case 'charset':
                        if (!skipCharset) {
                            pushOneLineAtrule(node, r);
                            skipCharset = true;
                        }
                        break;
                    case 'import':
                        if (!skipImport) {
                            pushOneLineAtrule(node, r);
                        }
                        skipCharset = true;
                        break;
                    case 'namespace':
                        pushOneLineAtrule(node, r);
                        skipCharset = skipImport = true;
                        break;
                    case 'media':
                        if (node.nodes.length) {
                            t = { type: 'atrule', value: node.value.slice(), content: [], nodes: $cssm.copyTree(node) };
                            r.push(t);
                            skipCharset = skipImport = true;
                        }
                        break;
                }
            }
        }

        return r;
    },

    /**
     * Минимизирует токены.
     *
     * @param {String[]} tokens токены для минимизации
     */
    minTokens: function(tokens) {
        $cssm.minNumbers(tokens);
        $cssm.minColors(tokens);
    },

    /**
     * Минимизирует числовые токены в массиве токенов.
     *
     * @param {String[]} tokens токены для минимизации
     */
    minNumbers: function(tokens) {
        var allowed = { ' ': 1, ',': 1, '+': 1, '-': 1, '*': 1, '/': 1, '(': 1, ')': 1, '[': 1, ']': 1 };

        for (var i = 0, ct, pt; i < tokens.length; i++) {
            ct = tokens[i];
            pt = tokens[i - 1];
            if (ct === '(' && (pt === 'url' || pt === 'expression')) i++;
            else {
                if (ct !== '.' && (pt === undefined || pt in allowed) && /^[0-9]*\.?([0-9]+([a-z]{1,2}|%)?)?$/.test(ct)) { // is number
                    if (/^0*/.test(ct)) ct = ct.replace(/^0+/, '');
                    if (/\.0*$/.test(ct)) ct = ct.replace(/\.0*$/, '');
                    if (/\.0*[a-z]{2}$/.test(ct)) ct = ct.slice(0, ct.indexOf('.')) + ct.slice(-2);
                    else if (/\.0*[a-z]{1}$/.test(ct)) ct = ct.slice(0, ct.indexOf('.')) + ct.slice(-1);
                    else if (/\.0*%$/.test(ct)) ct = ct.replace(/\.0*%$/, '%');
                    
                    if (!ct || /^\.?([a-z]{1,2})?$/.test(ct)) ct = '0';
                    else if (ct === '%') ct = '0%';
                }
                tokens[i] = ct;
            }
        }
    },

    /**
     * Минимизирует токены цвета в массиве токенов.
     *
     * @param {String[]} tokens токены для минимизации
     */
    minColors: function(tokens) {
        var map = {
            'yellow': '#ff0',
            'fuchsia': '#f0f',
            'white': '#fff',
            'black': '#000',
            'blue': '#00f',
            'aqua': '#0ff',
            '#f00': 'red',
            '#c0c0c0': 'silver',
            '#808080': 'gray',
            '#800000': 'maroon',
            '#800080': 'purple',
            '#008000': 'green',
            '#808000': 'olive',
            '#000080': 'navy',
            '#008080': 'teal'
        },
        i = 0,
        j, ct, pt, temp, temp2, rgb,
        recolh3 = /[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]/,
        recolh6 = /[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]/,
        rergb = /^\(\d{1,3},\d{1,3},\d{1,3}\)$/;

        for (; i < tokens.length; i++) {
            ct = tokens[i].toLowerCase();
            pt = tokens[i - 1];

            if (ct === '(' && (pt === 'url' || pt === 'expression')) i++;
            else {
                if (map[ct]) tokens[i] = map[ct];
                else if (ct === 'rgb') {
                    if (i + 7 < tokens.length) {
                        rgb = tokens.slice(i + 1, i + 8).join('');
                        if (rergb.test(rgb)) {
                            temp = '';
                            for (j = 2; j < 8; j += 2) {
                                temp2 = Number(tokens[i + j]).toString(16);
                                temp += temp2.length === 1 ? ('0' + temp2) : temp2;
                            }
                            if (temp.length === 6) {
                                tokens.splice(i, 8, '#', temp);
                                ct = '#';
                            } else tokens.splice(i, 8, ct + rgb);
                        } else tokens.splice(i, 8, ct + rgb);
                    }
                }
                if (ct === '#' && i < tokens.length - 1) {
                    temp = tokens[i + 1];
                    if (recolh6.test(temp)) {
                        if (temp.charAt(0) === temp.charAt(1) &&
                            temp.charAt(2) === temp.charAt(3) &&
                            temp.charAt(4) === temp.charAt(5)) {
                            temp = temp.charAt(0) + temp.charAt(2) + temp.charAt(4);
                        }
                        tokens.splice(i--, 2, '#' + temp);
                    } else if (recolh3.test(temp)) {
                        tokens.splice(i--, 2, '#' + temp);
                    }
                }
            }
        }
    },

    /**
     * Минимизирует токены свойства font-weight.
     *
     * @param {String[]} tokens токены для минимизации
     */
    minFontWeight: function(tokens) {
        if (tokens[0] === 'normal') tokens[0] = '400';
        else if (tokens[0] === 'bold') tokens[0] = '700';
    },

    safe: function(nodes) {
        var i, j, k, t, node, indice = {}, s, d,
            pNode, cNode, nNode, onceAgain;

        // cleanup @imports
        for (i = 0; i < nodes.length; i++) {
            node = nodes[i];
            if (node.type === 'atrule' && node.value[1] === 'import') {
                k = node.value.join('');
                if (k in indice) nodes.splice(i--, 1);
                else indice[k] = true;
            }
        }

        // join equal selectors
        for (i = 0; i < nodes.length; i++) {
            cNode = nodes[i];
            if (cNode.type === 'ruleset' && (j = $cssm.nextNode(nodes, 'ruleset', i + 1)) !== -1) {
                nNode = nodes[j];
                if ($cssm.joinValue(cNode.value, true) === $cssm.joinValue(nNode.value, true)) {
                    cNode.content = cNode.content.concat(nNode.content);
                    nodes.splice(j, 1);
                }
            }
        }

        // expand nodes
        for (i = nodes.length - 1; i !== -1; i--) {
            node = nodes[i];
            if (node.type === 'ruleset') {
                $cssm.expandShorthands(node.content);
                nodes = [].concat(nodes.slice(0, i), $cssm.expandNode(node), nodes.slice(i + 1));
            } else if (node.type === 'atrule' && (node.value[1] === 'font-face' || node.value[1] === 'page')) {
                $cssm.expandShorthands(node.content);
            }
        }

        // gather indice
        for (i = nodes.length - 1; i !== -1; i--) {
            node = nodes[i];
            if (node.type === 'ruleset') {
                s = $cssm.joinValue(node.value);
                t = indice[s] || {};
                for (j = node.content.length - 1; j !== -1; j--) {
                    d = node.content[j];
                    k = t[d.name[0]];
                    if (k === undefined || (d.important && !k.important)) t[d.name[0]] = d;
                }
                indice[s] = t;
            }
        }

        // cleanup content and nodes
        for (i = nodes.length - 1; i !== -1; i--) {
            t = false;
            node = nodes[i];
            if (node.content.length) {
                if (node.type === 'ruleset') {
                    t = $cssm.prepareNode($cssm.joinValue(node.value), node.content, indice);
                } else if (node.type === 'atrule' && (node.value[1] === 'font-face' || node.value[1] === 'page')) {
                    t = $cssm.prepareNode(node.value.join(''), node.content, null);
                }

                if (t) {
                    node.content = $cssm.collapseShorthands(node.content);
                } else nodes.splice(i, 1);
            }
        }

        do {
            onceAgain = false;
            for (i = 0; i < nodes.length; i++) {
                if ((cNode = nodes[i]).type === 'ruleset') {
                    nNode = ((j = $cssm.nextNode(nodes, 'ruleset', i + 1)) !== -1 ? nodes[j] : null);
                    if (nNode && $cssm.joinValue(cNode.value, true) === $cssm.joinValue(nNode.value, true)) {
                        cNode.content = cNode.content.concat(nNode.content);
                        nodes.splice(j, 1);
                        onceAgain = true;
                    } else if (nNode && cNode.content.length === nNode.content.length && $cssm.tryToJoinNodes(nodes, i, j)) {
                        i--;
                        onceAgain = true;
                    } else {
                        pNode = ((j = $cssm.prevNode(nodes, 'ruleset', i - 1)) !== -1 ? nodes[j] : null);
                        if (pNode && nNode && $cssm.equalContent(pNode.content, nNode.content)) pNode = null;
                        if ($cssm.mergeNodes(cNode, pNode, nNode)) {
                            if (!cNode.content.length) nodes.splice(i, 1);
                            else i = j;
                            onceAgain = true;
                        }
                    }
                }
            }
        } while (onceAgain);

        $cssm.restoreOrder(nodes);

        for (i = 0; i < nodes.length; i++) {
            if (nodes[i].type === 'atrule' && nodes[i].value[1] === 'media') nodes[i].nodes = $cssm.safe(nodes[i].nodes);
        }

        return nodes;
    },

    isOrderCorrect: function(content) {
        var prev = 0, i = 0, n;

        for (; i < content.length; i++) {
            n = content[i].n;
            if (n > 0) {
                if (n !== prev + 1) return false;
                else prev = n;
            }
        }

        return true;
    },

    mergeNodes: function(src, dstp, dstn) {
        var extractP = false,
            extractN = false;

        if (dstp && $cssm.contains(src.content, dstp.content, false)
                && $cssm.getContentLength(dstp.content) > $cssm.joinValue(src.value).length) {
            dstp.value = dstp.value.concat(src.value);
            extractP = true;
        }

        if (dstn && $cssm.contains(src.content, dstn.content, true)
                && $cssm.getContentLength(dstn.content) > $cssm.joinValue(src.value).length) {
            dstn.value = src.value.concat(dstn.value);
            extractN = true;
        }

        extractP && (src.content = $cssm.extract(src.content, dstp.content));
        extractN && (src.content = $cssm.extract(src.content, dstn.content));

        return extractP || extractN;
    },

    extract: function(content, toExtract) {
        var i = 0, j,
            _content = content.slice();

        for (i = 0; i < toExtract.length; i++) {
            if ((j = $cssm.findSame(_content, toExtract[i].key)) !== -1) _content.splice(j, 1);
        }
        
        return _content;
    },

    contains: function(container, toCheck, tail) {
        var i, j, dc, dt, n = 0, nc = 0, nt = 0,
            _container = container.slice(),
            _toCheck = toCheck.slice();

        _container.sort($cssm.sortContentByN);
        _toCheck.sort($cssm.sortContentByN);

        if (!tail) {
            for (i = 0; i < _toCheck.length; i++) {
                dt = _toCheck[i];
                if ((j = $cssm.findSame(_container, dt.key)) !== -1) {
                    dc = _container[j];
                    if (dt.n > 0 && dc.n > 0 && dt.n !== dc.n) return false;
                } else return false;
            }
        } else {
            nc = _container.length && _container[_container.length - 1].n;
            nt = _toCheck.length && _toCheck[_toCheck.length - 1].n;
            n = (nc > 0 && nt > 0) ? nc - nt : 0;

            for (i = _toCheck.length - 1; i !== -1; i--) {
                dt = _toCheck[i];
                if ((j = $cssm.findSame(_container, dt.key)) !== -1) {
                    dc = _container[j];
                    if (dt.n > 0 && dc.n > 0 && dt.n !== dc.n - n) return false;
                } else return false;
            }
        }

        return true;
    },

    findSame: function(a, key) {
        for (var i = 0; i < a.length; i++) if (a[i].key === key) return i;
        return -1;
    },

    sort: function(toUse, toSort, ignoreAbsent) {
        var i = 0, j, d;

        for (; i < toUse.length; i++) {
            d = toUse[i];
            if ((j = $cssm.findSame(toSort, d.key)) !== -1) {
                d = toSort[j];
                toSort.splice(j, 1);
                toSort.splice(i, 0, d);
            } else if (!ignoreAbsent) return false;
        }

        return true;
    },

    join: function(c1, c2) {
        var i = 0, n = 1;

        for (; i < c1.length; i++) if (c1[i].n > 0 || c2[i].n > 0) c1[i].n = n++;

        return c1;
    },

    resort: function(c1, c2) {
        return ($cssm.sort(c1, c2) && $cssm.sort(c2, c1));
    },

    equalContent: function(c1, c2) {
        return c1.length === c2.length &&
               (!($cssm.resort(c1, c2)) ? false : $cssm.isOrderCorrect(c1) && $cssm.isOrderCorrect(c2));
    },

    tryToJoinNodes: function(nodes, i, j) {
        var node1 = nodes[i],
            node2 = nodes[j],
            c1, c2;

        if ($cssm.joinValue(node1.value, true) === $cssm.joinValue(node2.value, true)) {
            node1.content = node1.content.concat(node2.content);
            nodes.splice(j, 1);
            return true;
        } else {
            c1 = node1.content.slice();
            c2 = node2.content.slice();
            if ($cssm.equalContent(c1, c2)) {
                node1.content = $cssm.join(c1, c2);
                node1.value = node1.value.concat(node2.value);
                nodes.splice(j, 1);
                return true;
            }
        }

        return false;
    },

    prepareNode: function(value, content, indice) {
        var i = content.length - 1, d, t, k, n = 0;

        if (indice === null) {
            indice = {};
            t = indice[value] = {};
            for (; i != -1; i--) {
                d = content[i];
                k = t[d.name[0]];
                if (k === undefined || (d.important && !k.important)) t[d.name[0]] = d;
            }
        }

        for (i = content.length - 1; i != -1; i--) {
            d = content[i];
            if (!d.protect && (d.id !== indice[value][d.name[0]].id)) content.splice(i, 1);
            else d.key = d.name[0] + ':' + d.value.join('') + (d.important ? '!important' : '');
        }

        content.sort($cssm.sortContentByN);

        for (i = 0; i < content.length; i++) if (content[i].n > 0) content[i].n = ++n;

        content.orderedCount = n;

        return content.length;
    },

    /**
     * Сортирует свойства узлов.
     *
     * @param {Object[]} nodes узлы для сортировки
     */
    restoreOrder: function(nodes) {
        var i = 0, node;

        for (; i < nodes.length; i++) {
            node = nodes[i];
            if ($cssm.isContentNode(node)) node.content.sort($cssm.sortContentByN);
        }
    },

    /**
     * Проверяет, является ли узел блоком с набором свойств.
     *
     * @param {Object} node узел для проверки
     *
     * @returns {Boolean} если является, true, иначе false
     */
    isContentNode: function(node) {
        return node.type === 'ruleset' || (node.type === 'atrule' && (node.value[1] === 'font-face' || node.value[1] === 'page'));
    },

    /**
     * Раскрывает свойства margin / padding до примитивов, при этом удаляет оригиналы.
     *
     * @param {Object[]} content массив свойств
     */
    expandShorthands: function(content) {
        var i, d, values = [];

        for (i = 0; i < content.length; i++) {
            d = content[i];
            if (!d.protect && d.n < 0 && (d.name[0] === 'margin' || d.name[0] === 'padding')) {
                values = d.value.join('').split(' ');
                values[1] === undefined && values.push(values[0]);
                values[2] === undefined && values.push(values[0]);
                values[3] === undefined && values.push(values[1]);
                content.splice(i, 1,
                    { name: [d.name[0] + '-top'], value: [values[0]], important: d.important, n: d.n, id: d.id },
                    { name: [d.name[0] + '-right'], value: [values[1]], important: d.important, n: d.n, id: d.id },
                    { name: [d.name[0] + '-bottom'], value: [values[2]], important: d.important, n: d.n, id: d.id },
                    { name: [d.name[0] + '-left'], value: [values[3]], important: d.important, n: d.n, id: d.id }
                );
            }
        }
    },

    /**
     * Собирает примитивы margin / padding в минимальный по длине набор свойств, при этом удаляет оригиналы.
     *
     * @param {Object[]} content массив свойств
     *
     * @returns {Object[]} обработанный массив свойств
     */
    collapseShorthands: function(content) {
        var names = {
                'margin': { 'margin-top': 0, 'margin-right': 1, 'margin-bottom': 2, 'margin-left': 3 },
                'padding': { 'padding-top': 0, 'padding-right': 1, 'padding-bottom': 2, 'padding-left': 3 }
            },
            r = [];

        function _collapseShorthand(name) {
            var i, d, t, n = -1000000, hasTRBL = false,
                dname,
                sh = {},
                v = [null, null, null, null],
                imp = { n: 0, names: {} },
                allowBase = true,
                impMode;

            // собрать shorthand'ы
            for (i = 0; i < content.length; i++) {
                d = content[i];
                dname = d.name[0];
                if (!d.protect && dname in names[name]) {
                    t = sh[dname];
                    if (t = sh[dname]) {
                        if (!t.important || d.important) t = d;
                    } else t = d;
                    sh[dname] = t;
                    content.splice(i--, 1);
                }
            }

            // заполнить значения для создания margin / padding
            for (i in sh) {
                d = sh[i];
                v[names[name][i]] = d.value.join('');
                if (d.n > n) n = d.n;
                if (d.important) {
                    imp.n++;
                    imp.names[i] = true;
                }
                hasTRBL = true;
            }

            if (hasTRBL) {
                if (v[0] && v[1] && v[2] && v[3]) {
                    impMode = imp.n && imp.n !== 4;
                    t = [];
                    if (v[3] === v[1] || (impMode && imp.names[name + '-left'])) v.length--;
                    if (v.length === 3 && (v[2] === v[0] || (impMode && imp.names[name + '-bottom']))) v.length--;
                    if (v.length === 2 && (v[1] === v[0] || (impMode && imp.names[name + '-right']))) v.length--;

                    for (i = 0; i < v.length - 1; i++) t.push(v[i]), t.push(' ');
                    t.push(v.slice(-1)[0]);

                    if (imp.n === 3 && !imp.names[name + '-left']) { // в ряде случаев без margin / padding короче
                        d = sh[name + '-left'];
                        allowBase = ((name + ':' + t.join('')).length < (d.name + ':' + d.value.join('')).length);
                    }

                    if (allowBase) r.push($cssm.createDeclaration([name], t, imp.n === 4, n));

                    if (impMode) for (i in sh) if (sh[i].important || !allowBase) r.push(sh[i]);
                } else {
                    for (i in names[name]) {
                        t = names[name][i];
                        if (v[t]) r.push($cssm.createDeclaration([i], [v[t]], imp.names[i] === true, n));
                    }
                }
            }
        }

        _collapseShorthand('margin');
        _collapseShorthand('padding');

        if (r.length) {
            r = r.concat(content);
            r.sort($cssm.sortContentByN);
            return r;
        } else return content;
    },

    createDeclaration: function(name, value, important, n, id) {
        return { name: name, value: value, important: important, n: n, id: id,
                 key: name.join('') + ':' + value.join('') + (important ? '!important' : '') };
    },

    /**
     * Объединяет все значения 2-мерного массива в одну строку.
     *
     * @param {[String[]]} value значения для объединения
     * @param {Boolean} ordered сортировать ли по алфавиту перед объединением
     *
     * @returns {String} результат объединения
     */
    joinValue: function(value, ordered) {
        var s = '', i, t = [];

        if (ordered) {
            for (i = 0; i < value.length; i++) t.push(value[i].join(''));
            t.sort();
            return t.join(',');
        } else {
            for (i = 0; i < value.length; i++) s+= value[i].join('') + ',';
            return s.slice(0, -1);
        }
    },

    /**
     * Ищет предыдущий узел указанного типа.
     *
     * @param {Object[]} nodes набор узлов, среди которых искать
     * @param {String} type искомый тип узла
     * @param {Number} i индекс, с которого начинать поиск
     *
     * @returns {Number} если найден, индекс, иначе -1
     */
    prevNode: function(nodes, type, i) {
        for (; i !== -1; i--) if (nodes[i].type === type) return i;
        return -1;
    },

    /**
     * Ищет следующий узел указанного типа.
     *
     * @param {Object[]} nodes набор узлов, среди которых искать
     * @param {String} type искомый тип узла
     * @param {Number} i индекс, с которого начинать поиск
     *
     * @returns {Number} если найден, индекс, иначе -1
     */
    nextNode: function(nodes, type, i) {
        for (; i < nodes.length; i++) if (nodes[i].type === type) return i;
        return -1;
    },

    /**
     * Разделяет узел с набором селектора на такие же узлы, но по одному селектору в каждом.
     *
     * @param {Object} node узел для разделения
     *
     * @returns {Object[]} разделённые узлы
     */
    expandNode: function(node) {
        var r = [], i;

        for (i = 0; i < node.value.length; i++) {
            r.push({ type: node.type,
                     value: [node.value[i].slice()],
                     content: $cssm.copyContent(node.content),
                     nodes: [] });
        }

        return r;
    },

    /**
     * Копирует набор свойств.
     *
     * @param {Object[]} content набор свойств для копирования
     *
     * @returns {Object[]} копия
     */
    copyContent: function(content) {
        var r = [];

        content.forEach(function(d) {
            r.push({ name: d.name.slice(), value: d.value.slice(), important: d.important, n: d.n, protect: d.protect, id: d.id });
        });

        return r;
    },

    /**
     * Вычисляет суммарную длину свойств в символах.
     *
     * @param {Object[]} content набор свойств
     *
     * @returns {Number} суммарная длина свойств в символах
     */
    getContentLength: function(content) {
        var l = 0, i = 0;
        for (; i < content.length; i++) l += content[i].key.length;
        return l;
    },

    /**
     * Функция для сортировки свойств внутри блока, используется в [].sort().
     *
     * @param {Object} a одно свойство
     * @param {Object} b другое свойство
     *
     * @returns {Number} результат сравнения
     */
    sortContentByN: function(a, b) {
        return a.n - b.n;
    },

    /**
     * Функция для сортировки свойств внутри блока, используется в [].sort().
     *
     * @param {Object} a одно свойство
     * @param {Object} b другое свойство
     *
     * @returns {Number} результат сравнения
     */
    sortContentByKey: function(a, b) {
        return a.key > b.key;
    }

};

if (typeof window === 'undefined') {
    exports.minimize = $cssm.minimize;
}