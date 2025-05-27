module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "18.31.2"

  cluster_name                  = "chatbot-cluster"
  cluster_version               = "1.28"
  vpc_id                        = module.vpc.vpc_id
  enable_irsa                   = true
  cluster_endpoint_public_access = true

  subnet_ids = module.vpc.private_subnets

  eks_managed_node_groups = {
    default = {
      desired_size   = 2
      min_size       = 1
      max_size       = 3
      instance_types = ["t3.medium"]
      capacity_type  = "ON_DEMAND"
    }
  }
}
