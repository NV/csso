# CSSO — CSS Optimizer

<table><tr><td>Before</td><td>After</td></tr>
<tr><td><pre>a {
    font-family: Aria, sans-serif;
    font-size: 12px;
}
b {
    font-size: 12px;
}<pre></td></tr><tr><td><pre>a{font-family:Aria,sans-serif}a,b{font-size:12px}</pre></td></tr></table>

## npm

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
