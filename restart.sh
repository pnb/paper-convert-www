which python | grep paper_convert || {
    echo "Remember to conda activate paper_convert first"
    exit 1
}
killall node
nohup npm start >> stdout.txt &
sleep 6
tail -n 5 stdout.txt
