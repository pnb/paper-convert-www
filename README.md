# Paper conversion frontend

## Server configuration

Assuming you are running an Ubuntu/Debian-like server, install the required packages like this:

```bash
sudo apt install libreoffice-nogui
sudo apt install inkscape
sudo apt install npm
sudo apt install nginx
sudo apt install ruby-dev  # Needed for anystyle-cli
sudo gem install anystyle-cli
```

Now install a new, full version of TexLive, at least 2022 or newer (e.g., `apt install texlive-full`). This may require an OS upgrade or [manual install](https://ftp.math.utah.edu/pub/tex/historic/systems/texlive) since the version is very important. In particular, `make4ht`, the LaTeX HTML compiler, is rapidly evolving and has many quirks. Run `make4ht --version` to make sure you have version 0.3l or newer. This is still a source of problems since much of the conversion scripts in this repository are dedicated to post-processing the idiosyncrasies of make4ht (though it gets better all the time!).

Create a relatively unprivileged *nodewww* user to run the server process:

```bash
sudo useradd -m nodewww
sudo passwd nodewww
sudo usermod -a -G sudo nodewww
```

Then install conda (as the user that will run NodeJS) if you don't already have it:

```bash
su nodewww
cd
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
sh Miniconda3-latest-Linux-x86_64.sh
```

Likewise install `n`, a NodeJS version manager, as that same user. `n` allows you to run a specific version of NodeJS:

```bash
sudo npm install -g n
sudo n 19  # Install NodeJS version 19.x
```

Close and reopen the terminal or run `bash` to start a new one and get everything in the path.

Fix problem with ImageMagick refusing to convert PDFs because of an old security problem:

```bash
sudo vim /etc/ImageMagick-6/policy.xml
# Look for <!-- disable ghostscript format types --> and delete all of those restrictions
```

## Installation

Clone this repository onto the server, e.g., into the home directory of the user that will run the server.

Also clone the *paper-convert-scripts* repository and complete the setup for that. If you installed it somewhere other than alongside this repository, you will need to edit `package.json` (for this repository, not that one) to point `conversion_scripts_dir` to the correct place. Also set `admin_page_password` to something memorable (security provisions are super basic, and not intended to defend against malicious parties so much as inquisitive ones).

Then install the exact version of everything from `package-lock.json` by running:

```bash
npm ci
```

## Set up SSL certificates

```bash
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
```

At this point you should probably install security updates and restart your server:

```bash
sudo apt upgrade
sudo shutdown -r now
```

## Running the server

From the *paper-convert-www* directory, as your unprivileged user, run:

```bash
conda activate paper_convert
./restart.sh
```

## Backing up/downloading papers

Note the trailing slashes are important!

```bash
rsync -rtuvm --include="*/" --include="*.zip" --exclude="*" nodewww@SERVER:paper-convert-www/papers/ ~/Downloads/pcpapers

# --include/--exclude stuff can be dropped to get everything (not only zip files)
# r = recursive
# t = send timestamps?
# u = only update files with newer timestamps
# v = verbose (show files sent)
# m = avoid creating empty directories in the destination
# Add --dry-run if needed to see what would be transferred
```
