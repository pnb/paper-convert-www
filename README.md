# Paper conversion frontend

## Server configuration

Assuming you are running an Ubuntu/Debian-like server, install the required packages like this:

    sudo apt install libreoffice-nogui
    sudo apt install inkscape
    sudo apt install npm
    sudo apt install nginx
    sudo apt install perl-tk  # Needed for manual installation of TexLive
    sudo apt install ruby-dev  # Needed for anystyle-cli
    sudo gem install anystyle-cli

Now install a new version of TexLive, since the version (as of Ubuntu 21.10) is not new enough. In particular, `make4ht` versions 0.3g and 0.3k are known to work, but 0.3f does not support subfigures properly. Hopefully this will change in the future since it is currently difficult to install a specific version of TexLive and it is clearly a source of possible problems. Install TexLive 2021 like this:

    wget https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2021/install-tl-unx.tar.gz
    tar xzf install-tl-unx.tar.gz
    cd install-tl-20210324
    sudo ./install-tl  # It may be necessary to add "-repository https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2021" to avoid getting a newer TexLive though I am not surre if this will work

Create a relatively unprivileged *nodewww* user to run the server process:

    sudo useradd -m nodewww
    sudo passwd nodewww

Add the new TexLive installation to the user's PATH by adding this line to the end of `/home/nodewww/.bashrc`:

    export PATH="/usr/local/texlive/2021/bin/x86_64-linux:$PATH"

Then install conda (as the user that will run NodeJS) if you don't already have it:

    su nodewww
    cd
    wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
    sh Miniconda3-latest-Linux-x86_64.sh

Likewise install `n`, a NodeJS version manager, as that same user. `n` allows you to run a specific version of NodeJS:

    sudo npm install -g n
    sudo n 17  # Install NodeJS version 17.x

Close and reopen the terminal or run `bash` to start a new one and get everything in the path.

Fix problem with ImageMagick refusing to convert PDFs because of an old security problem:

    sudo vim /etc/ImageMagick-6/policy.xml
    # Look for <!-- disable ghostscript format types --> and delete all of those restrictions

Set up SSL certificates:

    sudo cp paper_nginx /etc/nginx/sites-available/
    sudo ln -s /etc/nginx/sites-available/paper_nginx /etc/nginx/sites-enabled/
    # Now replace the REPLACE_WITH_DOMAIN part with your domain, e.g., papers.example.com
    sudo vim /etc/nginx/sites-available/paper_nginx
    sudo rm /etc/nginx/sites-enabled/default  # Remove default config
    sudo systemctl restart nginx
    sudo snap install core
    sudo snap refresh core
    sudo snap install --classic certbot
    sudo certbot --nginx

## Installation

Clone this repository onto the server, e.g., into the home directory of the user that will run the server.

Also clone the *paper-convert-scripts* repository and complete the setup for that. If you installed it somewhere other than alongside this repository, you will need to edit `package.json` (for this repository, not that one) to point `conversion_scripts_dir` to the correct place.

Then install the exact version of everything from `package-lock.json` by running:

    npm ci

At this point you should probably install security updates and restart your server:

    sudo apt upgrade
    sudo shutdown -r now

## Running the server

From the *paper-convert-www* directory, as your unprivileged user, run:

    conda activate paper_convert
    npm start

You might want to keep it running after logging out. In that case, instead of the `npm start` line, run:

    nohup npm start >> stdout.txt &

Then if you want to stop it, run: `killall node`
