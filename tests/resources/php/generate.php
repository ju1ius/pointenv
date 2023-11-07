<?php

use Symfony\Component\Dotenv\Dotenv;

require __DIR__ . '/vendor/autoload.php';

generateSymfonyTests();


function generateSymfonyTests() {
    $dotenv = new Dotenv();
    foreach (glob(__DIR__.'/symfony/*.env') as $file) {
        $data = file_get_contents($file);
        $result = $dotenv->parse($data, $file);
        $name = basename($file);
        $outFile = __DIR__."/symfony/{$name}.expected.json";
        file_put_contents($outFile, json_encode($result, \JSON_PRETTY_PRINT));
    }
}
