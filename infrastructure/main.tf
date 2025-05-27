terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "<= 2.24.0"
    }
  }

  backend "s3" {
    bucket         = "chatbot-tfstate-927827734038-dev"  # ← tên bucket đã tạo thành công
    key            = "chatbot/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"                   # ← table lock đã tồn tại
    encrypt        = true
  }
}

provider "aws" {
  region = var.region
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.1"

  name                 = "chatbot-vpc"
  cidr                 = "10.0.0.0/16"
  azs                  = ["us-east-1a", "us-east-1b"]
  public_subnets       = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnets      = ["10.0.3.0/24", "10.0.4.0/24"]
  enable_nat_gateway   = true
  single_nat_gateway   = true
  one_nat_gateway_per_az = false
  enable_dns_hostnames = true
  enable_dns_support   = true
}
