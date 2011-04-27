# CSSO — CSS Optimizer

<table><tr><td>Before</td><td>After</td></tr>
<tr><td><pre>a {
    color: #FF0000;
}
b {
    color: #FF0000;
    font-weight: bold;
}</pre></td><td><pre>a,b{color:red}b{font-weight:700}</pre></td></tr></table>

## [npm](http://npmjs.org/)

    npm install cssom

## csso --help

    Usage:
        csso
            print this text
        csso <file_name>
            minimize CSS from file_name and write the result to stdout
        csso -r <file_name>
        csso --restructure <file_name>
            turn off restructure
        csso -h
        csso --help
            print this text
        csso -v
        csso --version
            print the CSSO version number

An example:

    $ echo ".test { color: red; color: green }" > test.css
    $ csso test.css
    .test{color:green}
